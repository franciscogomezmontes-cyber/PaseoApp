import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { useRecipeStore } from "../../src/store/useRecipeStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const CATEGORIAS_ING = [
  "Abarrotes",
  "Carnes y proteínas",
  "Frutas y verduras",
  "Lácteos y huevos",
  "Granos y cereales",
  "Condimentos",
  "Bebidas",
  "Panadería",
  "Enlatados",
  "Otros",
];

const UNIDADES = [
  "g",
  "kg",
  "ml",
  "l",
  "unidades",
  "tazas",
  "cucharadas",
  "cubos",
];

const TIPO_CONFIG: Record<string, { icon: string; color: string }> = {
  desayuno: { icon: "☀️", color: "#B45309" },
  almuerzo: { icon: "🍽️", color: "#1D4ED8" },
  cena: { icon: "🌙", color: "#6D28D9" },
  snack: { icon: "🥐", color: "#065F46" },
  "medias nueves": { icon: "🥪", color: "#B45309" },
  onces: { icon: "🍵", color: "#065F46" },
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function RecipesScreen() {
  const { recetas, loading, error, fetchRecetas } = useRecipeStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"recetas" | "ingredientes">(
    "recetas",
  );

  // Recetas search
  const [searchReceta, setSearchReceta] = useState("");
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  // Ingredientes
  const [ingredientes, setIngredientes] = useState<any[]>([]);
  const [loadingIng, setLoadingIng] = useState(false);
  const [searchIng, setSearchIng] = useState("");

  // Ingrediente modal
  const [showIngModal, setShowIngModal] = useState(false);
  const [editingIng, setEditingIng] = useState<any>(null);
  const [ingNombre, setIngNombre] = useState("");
  const [ingUnidad, setIngUnidad] = useState("g");
  const [ingCategoria, setIngCategoria] = useState("Otros");
  const [ingRecomendaciones, setIngRecomendaciones] = useState("");
  const [savingIng, setSavingIng] = useState(false);

  // Error modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  // Delete confirm
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      fetchRecetas();
      loadIngredientes();
    }, []),
  );

  const loadIngredientes = async () => {
    setLoadingIng(true);
    const { data } = await supabase
      .from("ingredientes")
      .select("*")
      .order("nombre");
    setIngredientes(data ?? []);
    setLoadingIng(false);
  };

  const openNewIng = () => {
    setEditingIng(null);
    setIngNombre("");
    setIngUnidad("g");
    setIngCategoria("Otros");
    setIngRecomendaciones("");
    setShowIngModal(true);
  };

  const openEditIng = (ing: any) => {
    setEditingIng(ing);
    setIngNombre(ing.nombre);
    setIngUnidad(ing.unidad_base);
    setIngCategoria(ing.categoria ?? "Otros");
    setIngRecomendaciones(ing.recomendaciones ?? "");
    setShowIngModal(true);
  };

  const handleSaveIng = async () => {
    if (!ingNombre.trim()) {
      showError("El nombre es obligatorio.");
      return;
    }
    setSavingIng(true);
    const payload = {
      nombre: ingNombre.trim(),
      unidad_base: ingUnidad,
      categoria: ingCategoria,
      recomendaciones: ingRecomendaciones.trim(),
    };
    const { error } = editingIng
      ? await supabase
          .from("ingredientes")
          .update(payload)
          .eq("id", editingIng.id)
      : await supabase.from("ingredientes").insert(payload);
    if (error) {
      showError(error.message);
      setSavingIng(false);
      return;
    }
    setSavingIng(false);
    setShowIngModal(false);
    await loadIngredientes();
  };

  const confirmDeleteIng = async () => {
    if (!deleteTarget) return;
    setShowDeleteModal(false);
    await supabase.from("ingredientes").delete().eq("id", deleteTarget.id);
    await loadIngredientes();
    setDeleteTarget(null);
  };

  // ─────────────────────────────────────────────
  // Recetas filtering & grouping
  // ─────────────────────────────────────────────
  const allKeywords: string[] = Array.from(
    new Set(recetas.flatMap((r) => r.palabras_clave ?? [])),
  ).sort();

  const filteredRecetas = recetas.filter((r) => {
    const matchSearch =
      searchReceta.length === 0 ||
      r.nombre.toLowerCase().includes(searchReceta.toLowerCase()) ||
      (r.palabras_clave ?? []).some((k: string) =>
        k.toLowerCase().includes(searchReceta.toLowerCase()),
      );
    const matchKeyword =
      !activeKeyword || (r.palabras_clave ?? []).includes(activeKeyword);
    return matchSearch && matchKeyword;
  });

  // Alphabetical grouping
  const alphabetical = [...filteredRecetas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );
  const grouped: Record<string, typeof recetas> = {};
  alphabetical.forEach((r) => {
    const letra = r.nombre[0]?.toUpperCase() ?? "#";
    if (!grouped[letra]) grouped[letra] = [];
    grouped[letra].push(r);
  });
  const letras = Object.keys(grouped).sort();

  if (loading && activeTab === "recetas") {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B4F72" />
        <Text style={styles.loadingText}>Cargando recetas...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📖 Recetas</Text>
        <Text style={styles.headerSub}>
          {activeTab === "recetas"
            ? `${recetas.length} recetas disponibles`
            : `${ingredientes.length} ingredientes en catálogo`}
        </Text>
      </View>

      {/* SUB-TABS */}
      <View style={styles.tabRow}>
        {(["recetas", "ingredientes"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text
              style={[styles.tabText, activeTab === t && styles.tabTextActive]}
            >
              {t === "recetas" ? "📖 Recetas" : "🥕 Ingredientes"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "recetas" ? (
        <FlatList
          data={letras}
          keyExtractor={(letra) => letra}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <>
              {/* SEARCH */}
              <View style={styles.searchWrapper}>
                <TextInput
                  style={styles.searchInput}
                  value={searchReceta}
                  onChangeText={(t) => {
                    setSearchReceta(t);
                    setActiveKeyword(null);
                  }}
                  placeholder="🔍 Buscar por nombre o palabra clave..."
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* KEYWORD CHIPS */}
              {allKeywords.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.keywordsScroll}
                  contentContainerStyle={styles.keywordsContent}
                >
                  <TouchableOpacity
                    style={[
                      styles.keywordChip,
                      !activeKeyword && styles.keywordChipActive,
                    ]}
                    onPress={() => setActiveKeyword(null)}
                  >
                    <Text
                      style={[
                        styles.keywordChipText,
                        !activeKeyword && styles.keywordChipTextActive,
                      ]}
                    >
                      Todas
                    </Text>
                  </TouchableOpacity>
                  {allKeywords.map((kw) => (
                    <TouchableOpacity
                      key={kw}
                      style={[
                        styles.keywordChip,
                        activeKeyword === kw && styles.keywordChipActive,
                      ]}
                      onPress={() =>
                        setActiveKeyword(activeKeyword === kw ? null : kw)
                      }
                    >
                      <Text
                        style={[
                          styles.keywordChipText,
                          activeKeyword === kw && styles.keywordChipTextActive,
                        ]}
                      >
                        {kw}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {letras.length === 0 && (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchIcon}>🔍</Text>
                  <Text style={styles.emptySearchText}>
                    {searchReceta.length > 0
                      ? `Sin resultados para "${searchReceta}"`
                      : "No hay recetas aún"}
                  </Text>
                </View>
              )}
            </>
          }
          renderItem={({ item: letra }) => (
            <View key={letra}>
              <View style={styles.letraHeader}>
                <Text style={styles.letraText}>{letra}</Text>
                <View style={styles.letraDivider} />
              </View>
              {grouped[letra].map((receta) => {
                const tipoConf = TIPO_CONFIG[receta.tipo_comida] ?? {
                  icon: "🍴",
                  color: "#475569",
                };
                const tiempoTotal =
                  (receta.tiempo_preparacion ?? 0) +
                  (receta.tiempo_coccion ?? 0);
                return (
                  <TouchableOpacity
                    key={receta.id}
                    style={[styles.card, { borderLeftColor: tipoConf.color }]}
                    onPress={() =>
                      router.push({
                        pathname: "/recipeDetail",
                        params: { id: receta.id },
                      })
                    }
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.recetaNombre}>{receta.nombre}</Text>
                      <Text style={styles.tipoIcon}>{tipoConf.icon}</Text>
                    </View>
                    {receta.descripcion ? (
                      <Text style={styles.descripcion} numberOfLines={2}>
                        {receta.descripcion}
                      </Text>
                    ) : null}
                    <View style={styles.cardMeta}>
                      {tiempoTotal > 0 && (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            ⏱ {tiempoTotal} min
                          </Text>
                        </View>
                      )}
                      {receta.porciones_base > 0 && (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaChipText}>
                            👤 {receta.porciones_base} por persona
                          </Text>
                        </View>
                      )}
                      {receta.es_vegano && (
                        <View style={[styles.metaChip, styles.dietChip]}>
                          <Text style={styles.dietChipText}>🌱 Vegano</Text>
                        </View>
                      )}
                      {receta.es_vegetariano && !receta.es_vegano && (
                        <View style={[styles.metaChip, styles.dietChip]}>
                          <Text style={styles.dietChipText}>
                            🥗 Vegetariano
                          </Text>
                        </View>
                      )}
                      {receta.sin_gluten && (
                        <View style={[styles.metaChip, styles.dietChip]}>
                          <Text style={styles.dietChipText}>🌾 Sin gluten</Text>
                        </View>
                      )}
                    </View>
                    {(receta.palabras_clave ?? []).length > 0 && (
                      <View style={styles.cardKeywords}>
                        {(receta.palabras_clave as string[])
                          .slice(0, 4)
                          .map((kw) => (
                            <View key={kw} style={styles.kwTag}>
                              <Text style={styles.kwTagText}>{kw}</Text>
                            </View>
                          ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/newRecipe")}
            >
              <Text style={styles.addButtonText}>+ Agregar nueva receta</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <>
          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              value={searchIng}
              onChangeText={setSearchIng}
              placeholder="🔍 Buscar ingrediente..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          {loadingIng ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1B4F72" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {ingredientes
                .filter((i) =>
                  i.nombre.toLowerCase().includes(searchIng.toLowerCase()),
                )
                .map((ing) => (
                  <TouchableOpacity
                    key={ing.id}
                    style={styles.ingRow}
                    onPress={() => openEditIng(ing)}
                    onLongPress={() => {
                      setDeleteTarget(ing);
                      setShowDeleteModal(true);
                    }}
                  >
                    <View style={styles.ingInfo}>
                      <Text style={styles.ingNombre}>{ing.nombre}</Text>
                      <Text style={styles.ingMeta}>
                        {ing.unidad_base} · {ing.categoria ?? "Otros"}
                      </Text>
                    </View>
                    <Text style={styles.ingEdit}>✏️</Text>
                  </TouchableOpacity>
                ))}

              {ingredientes.filter((i) =>
                i.nombre.toLowerCase().includes(searchIng.toLowerCase()),
              ).length === 0 &&
                searchIng.length > 0 && (
                  <View style={styles.emptySearch}>
                    <Text style={styles.emptySearchText}>
                      No se encontraron ingredientes para "{searchIng}"
                    </Text>
                  </View>
                )}

              <TouchableOpacity style={styles.addButton} onPress={openNewIng}>
                <Text style={styles.addButtonText}>
                  + Agregar nuevo ingrediente
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </>
      )}

      {/* ══ MODALS ══ */}

      {/* Error */}
      <Modal
        visible={showErrorModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>⚠️ Error</Text>
            <Text style={styles.confirmMsg}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#1B4F72" }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.confirmBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete ingrediente */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>¿Eliminar ingrediente?</Text>
            <Text style={styles.confirmMsg}>
              "{deleteTarget?.nombre}" será eliminado del catálogo.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
              onPress={confirmDeleteIng}
            >
              <Text style={styles.confirmBtnText}>Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: "#e2e8f0", marginTop: 8 },
              ]}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={[styles.confirmBtnText, { color: "#1e293b" }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ingrediente modal */}
      <Modal
        visible={showIngModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIngModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowIngModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingIng ? "✏️ Editar ingrediente" : "Nuevo ingrediente"}
            </Text>
            <TouchableOpacity onPress={handleSaveIng} disabled={savingIng}>
              <Text style={styles.modalSave}>
                {savingIng ? "..." : "Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={ingNombre}
                onChangeText={setIngNombre}
                placeholder="Ej: Aceite de oliva"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Unidad base</Text>
              <View style={styles.chipRow}>
                {UNIDADES.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, ingUnidad === u && styles.chipActive]}
                    onPress={() => setIngUnidad(u)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        ingUnidad === u && styles.chipTextActive,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.chipRow}>
                {CATEGORIAS_ING.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      ingCategoria === cat && styles.chipActive,
                    ]}
                    onPress={() => setIngCategoria(cat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        ingCategoria === cat && styles.chipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Recomendaciones</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={ingRecomendaciones}
                onChangeText={setIngRecomendaciones}
                placeholder="Marca, frescura, tamaño..."
                placeholderTextColor="#94a3b8"
                multiline
                textAlignVertical="top"
              />
            </View>
            {editingIng && (
              <TouchableOpacity
                style={styles.deleteIngBtn}
                onPress={() => {
                  setShowIngModal(false);
                  setTimeout(() => {
                    setDeleteTarget(editingIng);
                    setShowDeleteModal(true);
                  }, 300);
                }}
              >
                <Text style={styles.deleteIngText}>
                  🗑️ Eliminar ingrediente
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { color: "#64748b", marginTop: 12, fontSize: 14 },

  header: {
    backgroundColor: "#1B4F72",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 2 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: "#1B4F72" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  tabTextActive: { color: "#1B4F72" },

  searchWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#1e293b",
  },

  // Keyword chips
  keywordsScroll: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  keywordsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  keywordChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  keywordChipActive: { backgroundColor: "#1B4F72", borderColor: "#1B4F72" },
  keywordChipText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  keywordChipTextActive: { color: "#fff" },

  content: { padding: 16, paddingBottom: 40 },

  // Alphabetical index
  letraHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  letraText: { fontSize: 18, fontWeight: "800", color: "#1B4F72", width: 24 },
  letraDivider: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },

  // Recipe card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  recetaNombre: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
    marginRight: 8,
  },
  tipoIcon: { fontSize: 18 },
  descripcion: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
    marginBottom: 8,
  },

  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  metaChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaChipText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  dietChip: { backgroundColor: "#DCFCE7" },
  dietChipText: { fontSize: 11, color: "#15803D", fontWeight: "600" },

  cardKeywords: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 4,
  },
  kwTag: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  kwTagText: { fontSize: 11, color: "#1B4F72", fontWeight: "600" },

  // Ingredientes
  ingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  ingInfo: { flex: 1 },
  ingNombre: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  ingMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  ingEdit: { fontSize: 16 },

  emptySearch: { alignItems: "center", paddingVertical: 40 },
  emptySearchIcon: { fontSize: 36, marginBottom: 8 },
  emptySearchText: { fontSize: 14, color: "#94a3b8", textAlign: "center" },

  addButton: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: { color: "#64748b", fontSize: 14, fontWeight: "600" },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmMsg: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    textAlign: "center",
  },
  confirmBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalCancel: { fontSize: 15, color: "#64748b" },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  modalSave: { fontSize: 15, color: "#1B4F72", fontWeight: "700" },
  modalContent: { padding: 20 },
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#1B4F72" },
  deleteIngBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    alignItems: "center",
  },
  deleteIngText: { color: "#ef4444", fontWeight: "700", fontSize: 14 },
});
