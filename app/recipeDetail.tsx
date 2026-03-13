import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { useTripStore } from "../src/store/useTripStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const TIPO_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  desayuno: { icon: "☀️", color: "#B45309", bgColor: "#FEF3C7" },
  almuerzo: { icon: "🍽️", color: "#1D4ED8", bgColor: "#DBEAFE" },
  cena: { icon: "🌙", color: "#6D28D9", bgColor: "#EDE9FE" },
  snack: { icon: "🥐", color: "#065F46", bgColor: "#D1FAE5" },
  "medias nueves": { icon: "🥪", color: "#B45309", bgColor: "#FEF3C7" },
  onces: { icon: "🍵", color: "#065F46", bgColor: "#D1FAE5" },
};

const TAGS = [
  { key: "es_vegano", label: "🌱 Vegano", color: "#065F46", bg: "#D1FAE5" },
  {
    key: "es_vegetariano",
    label: "🥦 Vegetariano",
    color: "#15803D",
    bg: "#DCFCE7",
  },
  { key: "es_picante", label: "🌶️ Picante", color: "#B91C1C", bg: "#FEE2E2" },
  {
    key: "contiene_nueces",
    label: "🥜 Contiene nueces",
    color: "#92400E",
    bg: "#FEF3C7",
  },
  {
    key: "sin_gluten",
    label: "🌾 Sin gluten",
    color: "#1D4ED8",
    bg: "#DBEAFE",
  },
  {
    key: "sin_lactosa",
    label: "🥛 Sin lactosa",
    color: "#6D28D9",
    bg: "#EDE9FE",
  },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paseos, fetchPaseos } = useTripStore();

  const [receta, setReceta] = useState<any>(null);
  const [ingredientes, setIngredientes] = useState<any[]>([]);
  const [porciones, setPorciones] = useState(4);
  const [loading, setLoading] = useState(true);

  // Add to trip
  const [showAddToTripModal, setShowAddToTripModal] = useState(false);
  const [selectedPaseoId, setSelectedPaseoId] = useState<string | null>(null);
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null);
  const [selectedTipo, setSelectedTipo] = useState("almuerzo");
  const [fechas, setFechas] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  // Modals
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setShowErrorModal(true);
  };

  useEffect(() => {
    loadReceta();
    fetchPaseos();
  }, [id]);

  useEffect(() => {
    if (selectedPaseoId) {
      const paseo = paseos.find((p) => p.id === selectedPaseoId);
      if (paseo) {
        const dates: string[] = [];
        const start = new Date(paseo.fecha_inicio + "T12:00:00");
        const end = new Date(paseo.fecha_fin + "T12:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().split("T")[0]);
        }
        setFechas(dates);
        setSelectedFecha(dates[0] ?? null);
      }
    }
  }, [selectedPaseoId]);

  const loadReceta = async () => {
    setLoading(true);
    const { data: recetaData } = await supabase
      .from("recetas")
      .select("*")
      .eq("id", id)
      .single();
    if (recetaData) {
      setReceta(recetaData);
      setPorciones(recetaData.porciones_base ?? 4);
    }
    const { data: ingData } = await supabase
      .from("receta_ingredientes")
      .select("*, ingredientes(nombre, unidad_base)")
      .eq("receta_id", id);
    setIngredientes(ingData ?? []);
    setLoading(false);
  };

  const handleAddToTrip = async () => {
    if (!selectedPaseoId || !selectedFecha) {
      showError("Selecciona un paseo y una fecha.");
      return;
    }
    setAdding(true);
    const { data: partData } = await supabase
      .from("participaciones")
      .select("id")
      .eq("paseo_id", selectedPaseoId);
    const { error } = await supabase.from("momentos_comida").insert({
      paseo_id: selectedPaseoId,
      fecha: selectedFecha,
      tipo_comida: selectedTipo,
      receta_id: id,
      porciones: partData?.length ?? 1,
    });
    setAdding(false);
    if (error) {
      showError(error.message);
      return;
    }
    setShowAddToTripModal(false);
    setShowSuccessModal(true);
  };

  const scaledAmount = (cantidad: number) =>
    Math.round(cantidad * porciones * 100) / 100;

  const activeTags = TAGS.filter((t) => receta?.[t.key]);
  const tipoConfig =
    TIPO_CONFIG[receta?.tipo_comida] ?? TIPO_CONFIG["almuerzo"];
  const tiempoTotal =
    (receta?.tiempo_preparacion ?? 0) + (receta?.tiempo_coccion ?? 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B4F72" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backText}>← Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: "/newRecipe", params: { id } })
              }
            >
              <Text style={styles.editText}>✏️ Editar</Text>
            </TouchableOpacity>
          </View>

          {/* Foto hero */}
          {receta?.foto_url ? (
            <Image
              source={{ uri: receta.foto_url }}
              style={styles.fotoHero}
              resizeMode="cover"
            />
          ) : null}

          <View
            style={[styles.tipoBadge, { backgroundColor: tipoConfig.bgColor }]}
          >
            <Text style={styles.tipoIcon}>{tipoConfig.icon}</Text>
            <Text style={[styles.tipoText, { color: tipoConfig.color }]}>
              {receta?.tipo_comida?.charAt(0).toUpperCase() +
                receta?.tipo_comida?.slice(1)}
            </Text>
          </View>
          <Text style={styles.headerTitle}>{receta?.nombre}</Text>
          {receta?.descripcion ? (
            <Text style={styles.headerDesc}>{receta.descripcion}</Text>
          ) : null}

          {/* Meta row: tiempos + porciones */}
          <View style={styles.headerMeta}>
            {tiempoTotal > 0 && (
              <View style={styles.headerMetaChip}>
                <Text style={styles.headerMetaText}>⏱ {tiempoTotal} min</Text>
              </View>
            )}
            {receta?.tiempo_preparacion > 0 && (
              <View style={styles.headerMetaChip}>
                <Text style={styles.headerMetaText}>
                  🔪 Prep: {receta.tiempo_preparacion} min
                </Text>
              </View>
            )}
            {receta?.tiempo_coccion > 0 && (
              <View style={styles.headerMetaChip}>
                <Text style={styles.headerMetaText}>
                  🔥 Cocción: {receta.tiempo_coccion} min
                </Text>
              </View>
            )}
            <View style={styles.headerMetaChip}>
              <Text style={styles.headerMetaText}>
                👤 {receta?.porciones_base} porciones base
              </Text>
            </View>
          </View>

          {/* Créditos */}
          {receta?.creditos ? (
            <Text style={styles.creditosText}>✍️ {receta.creditos}</Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* TAGS dietéticos */}
          {activeTags.length > 0 && (
            <View style={styles.tagsRow}>
              {activeTags.map((tag) => (
                <View
                  key={tag.key}
                  style={[styles.tag, { backgroundColor: tag.bg }]}
                >
                  <Text style={[styles.tagText, { color: tag.color }]}>
                    {tag.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Palabras clave */}
          {(receta?.palabras_clave ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔖 Palabras clave</Text>
              <View style={styles.kwRow}>
                {(receta.palabras_clave as string[]).map((kw) => (
                  <View key={kw} style={styles.kwTag}>
                    <Text style={styles.kwTagText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Utensilios */}
          {(receta?.utensilios ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🍳 Equipos y utensilios</Text>
              <View style={styles.kwRow}>
                {(receta.utensilios as string[]).map((u) => (
                  <View key={u} style={styles.utensilioTag}>
                    <Text style={styles.utensilioTagText}>{u}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* PORCIONES scaler */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍽️ Porciones</Text>
            <View style={styles.scalerRow}>
              <TouchableOpacity
                style={styles.scalerBtn}
                onPress={() => setPorciones((p) => Math.max(1, p - 1))}
              >
                <Text style={styles.scalerBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.scalerValue}>
                <Text style={styles.scalerNumber}>{porciones}</Text>
                <Text style={styles.scalerLabel}>porciones</Text>
              </View>
              <TouchableOpacity
                style={styles.scalerBtn}
                onPress={() => setPorciones((p) => p + 1)}
              >
                <Text style={styles.scalerBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {porciones !== receta?.porciones_base && (
              <TouchableOpacity
                onPress={() => setPorciones(receta?.porciones_base ?? 4)}
              >
                <Text style={styles.resetText}>
                  Restablecer a {receta?.porciones_base} porciones
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* INGREDIENTES */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛒 Ingredientes</Text>
            {ingredientes.length === 0 ? (
              <Text style={styles.emptyText}>
                No hay ingredientes registrados
              </Text>
            ) : (
              ingredientes.map((ing, i) => (
                <View
                  key={ing.id}
                  style={[
                    styles.ingredienteRow,
                    i === ingredientes.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={styles.ingredienteNombre}>
                    {ing.ingredientes?.nombre}
                  </Text>
                  <Text style={styles.ingredienteCantidad}>
                    {scaledAmount(ing.cantidad_por_porcion)}{" "}
                    {ing.ingredientes?.unidad_base}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* PREPARACIÓN */}
          {receta?.instrucciones && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Preparación</Text>
              {receta.instrucciones
                .split("\n")
                .filter(Boolean)
                .map((step: string, i: number) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
            </View>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.addToTripBtn}
            onPress={() => setShowAddToTripModal(true)}
          >
            <Text style={styles.addToTripBtnText}>
              🗺️ Agregar al menú de un paseo
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══ MODALS ══ */}

        {/* Error */}
        <Modal
          visible={showErrorModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowErrorModal(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>⚠️ Error</Text>
              <Text style={styles.modalMsg}>{errorMsg}</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#1B4F72" }]}
                onPress={() => setShowErrorModal(false)}
              >
                <Text style={styles.modalBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Success agregar */}
        <Modal
          visible={showSuccessModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>✅ Agregado</Text>
              <Text style={styles.modalMsg}>
                Receta agregada al menú del paseo.
              </Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.modalBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add to trip */}
        <Modal
          visible={showAddToTripModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAddToTripModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddToTripModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Agregar al menú</Text>
              <TouchableOpacity onPress={handleAddToTrip} disabled={adding}>
                <Text style={styles.modalSave}>
                  {adding ? "..." : "Agregar"}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.fieldLabel}>Paseo</Text>
              {paseos.length === 0 ? (
                <Text style={styles.emptyText}>No tienes paseos activos</Text>
              ) : (
                paseos.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.optionRow,
                      selectedPaseoId === p.id && styles.optionRowActive,
                    ]}
                    onPress={() => setSelectedPaseoId(p.id!)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedPaseoId === p.id && styles.optionTextActive,
                      ]}
                    >
                      {p.nombre}
                    </Text>
                    <Text style={styles.optionSub}>{p.lugar}</Text>
                  </TouchableOpacity>
                ))
              )}

              {selectedPaseoId && fechas.length > 0 && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
                    Fecha
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 16 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {fechas.map((fecha) => {
                      const d = new Date(fecha + "T12:00:00");
                      const label = d.toLocaleDateString("es-CO", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      });
                      return (
                        <TouchableOpacity
                          key={fecha}
                          style={[
                            styles.dateChip,
                            selectedFecha === fecha && styles.dateChipActive,
                          ]}
                          onPress={() => setSelectedFecha(fecha)}
                        >
                          <Text
                            style={[
                              styles.dateChipText,
                              selectedFecha === fecha &&
                                styles.dateChipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {selectedPaseoId && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 4 }]}>
                    Tipo de comida
                  </Text>
                  <View style={styles.tipoRow}>
                    {Object.entries(TIPO_CONFIG).map(([tipo, config]) => (
                      <TouchableOpacity
                        key={tipo}
                        style={[
                          styles.tipoBtn,
                          selectedTipo === tipo && {
                            backgroundColor: config.bgColor,
                            borderColor: config.color,
                          },
                        ]}
                        onPress={() => setSelectedTipo(tipo)}
                      >
                        <Text style={{ fontSize: 20 }}>{config.icon}</Text>
                        <Text
                          style={[
                            styles.tipoBtnText,
                            selectedTipo === tipo && { color: config.color },
                          ]}
                        >
                          {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    backgroundColor: "#1B4F72",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  editText: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" },

  fotoHero: { width: "100%", height: 200, borderRadius: 12, marginBottom: 14 },

  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  tipoIcon: { fontSize: 14 },
  tipoText: { fontSize: 12, fontWeight: "700" },
  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  headerDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },

  headerMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  headerMetaChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerMetaText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },

  creditosText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },

  content: { padding: 16, paddingBottom: 100 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: "700" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 14,
  },

  // Keywords & utensilios
  kwRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kwTag: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  kwTagText: { fontSize: 12, color: "#1B4F72", fontWeight: "600" },
  utensilioTag: {
    backgroundColor: "#FEF3C7",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  utensilioTagText: { fontSize: 12, color: "#92400E", fontWeight: "600" },

  // Scaler
  scalerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  scalerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1B4F72",
    alignItems: "center",
    justifyContent: "center",
  },
  scalerBtnText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 28,
  },
  scalerValue: { alignItems: "center" },
  scalerNumber: { fontSize: 36, fontWeight: "800", color: "#1B4F72" },
  scalerLabel: { fontSize: 12, color: "#94a3b8", marginTop: -4 },
  resetText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 10,
  },

  // Ingredientes
  ingredienteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  ingredienteNombre: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  ingredienteCantidad: { fontSize: 14, color: "#1B4F72", fontWeight: "700" },

  // Steps
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1B4F72",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  stepText: { flex: 1, fontSize: 14, color: "#1e293b", lineHeight: 20 },

  emptyText: { fontSize: 13, color: "#94a3b8", fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  addToTripBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  addToTripBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMsg: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    textAlign: "center",
  },
  modalBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

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
  modalHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  modalSave: { fontSize: 15, color: "#1B4F72", fontWeight: "700" },
  modalContent: { padding: 20 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 10,
  },
  optionRow: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  optionRowActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  optionText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  optionTextActive: { color: "#1B4F72" },
  optionSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  dateChipActive: { borderColor: "#1B4F72", backgroundColor: "#1B4F72" },
  dateChipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  dateChipTextActive: { color: "#fff" },
  tipoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  tipoBtn: {
    flex: 1,
    minWidth: "45%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
  },
  tipoBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
});
