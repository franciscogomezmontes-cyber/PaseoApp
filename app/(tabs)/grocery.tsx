import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../src/lib/supabase";
import { useTripStore } from "../../src/store/useTripStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const CATEGORIA_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  "Carnes y proteínas": { icon: "🥩", color: "#B91C1C", bg: "#FEE2E2" },
  "Frutas y verduras": { icon: "🥦", color: "#15803D", bg: "#DCFCE7" },
  "Lácteos y huevos": { icon: "🥛", color: "#1D4ED8", bg: "#DBEAFE" },
  "Granos y cereales": { icon: "🌾", color: "#92400E", bg: "#FEF3C7" },
  Condimentos: { icon: "🧂", color: "#6D28D9", bg: "#EDE9FE" },
  Bebidas: { icon: "🧃", color: "#0369A1", bg: "#E0F2FE" },
  Panadería: { icon: "🍞", color: "#B45309", bg: "#FEF3C7" },
  Enlatados: { icon: "🥫", color: "#64748b", bg: "#F1F5F9" },
  Extras: { icon: "🛒", color: "#475569", bg: "#F8FAFC" },
  Otros: { icon: "📦", color: "#475569", bg: "#F8FAFC" },
  Abarrotes: { icon: "🧴", color: "#475569", bg: "#F8FAFC" },
};
const getCategoriaConfig = (cat: string) =>
  CATEGORIA_CONFIG[cat] ?? CATEGORIA_CONFIG["Otros"];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function GroceryScreen() {
  const { paseos, fetchPaseos } = useTripStore();

  // ── Data ──
  const [itemsPorPaseo, setItemsPorPaseo] = useState<Record<string, any[]>>({});
  const [loadingData, setLoadingData] = useState(false);
  const [generatingPaseoId, setGeneratingPaseoId] = useState<string | null>(
    null,
  );
  const [collapsedPaseos, setCollapsedPaseos] = useState<
    Record<string, boolean>
  >({});
  const [initialized, setInitialized] = useState(false);

  // ── Ingredient catalogue ──
  const [ingredienteCatalogo, setIngredienteCatalogo] = useState<any[]>([]);

  // ── Add extra modal ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalPaseoId, setAddModalPaseoId] = useState<string>("");
  const [extraNombre, setExtraNombre] = useState("");
  const [extraCantidad, setExtraCantidad] = useState("");
  const [extraUnidad, setExtraUnidad] = useState("");
  const [extraCategoria, setExtraCategoria] = useState("Extras");
  const [extraRecomendaciones, setExtraRecomendaciones] = useState("");
  const [savingExtra, setSavingExtra] = useState(false);
  const [busquedaExtra, setBusquedaExtra] = useState("");
  const [showIngCatalogo, setShowIngCatalogo] = useState(false);

  // ── Recommendations modal ──
  const [showRecomModal, setShowRecomModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // ── Confirm modals ──
  const [showConfirmGenerar, setShowConfirmGenerar] = useState(false);
  const [confirmGenerarPaseoId, setConfirmGenerarPaseoId] =
    useState<string>("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsTarget, setOptionsTarget] = useState<any>(null);

  // ── Error modal ──
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  const filteredIngCatalogo = ingredienteCatalogo.filter((i) =>
    i.nombre.toLowerCase().includes(busquedaExtra.toLowerCase()),
  );

  // ─────────────────────────────────────────────
  // Load data
  // ─────────────────────────────────────────────
  const loadAllItems = useCallback(
    async (paseoList = paseos) => {
      if (paseoList.length === 0) return;
      setLoadingData(true);
      const paseoIds = paseoList.map((p) => p.id);
      const { data } = await supabase
        .from("lista_mercado")
        .select("*")
        .in("paseo_id", paseoIds)
        .order("categoria")
        .order("nombre");

      const grouped: Record<string, any[]> = {};
      paseoIds.forEach((pid) => {
        grouped[pid!] = [];
      });
      (data ?? []).forEach((item: any) => {
        grouped[item.paseo_id]?.push(item);
      });
      setItemsPorPaseo(grouped);

      if (!initialized) {
        const allCollapsed: Record<string, boolean> = {};
        paseoIds.forEach((pid) => {
          allCollapsed[pid!] = true;
        });
        setCollapsedPaseos(allCollapsed);
        setInitialized(true);
      }
      setLoadingData(false);
    },
    [paseos, initialized],
  );

  const loadIngredientes = async () => {
    const { data } = await supabase
      .from("ingredientes")
      .select("*")
      .order("nombre");
    setIngredienteCatalogo(data ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      fetchPaseos();
      loadIngredientes();
    }, []),
  );

  useEffect(() => {
    if (paseos.length > 0) loadAllItems(paseos);
  }, [paseos]);

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────
  const handleGenerate = async (paseoId: string) => {
    setShowConfirmGenerar(false);
    setGeneratingPaseoId(paseoId);

    const { data: momentos } = await supabase
      .from("momentos_comida")
      .select("*, recetas(id, nombre)")
      .eq("paseo_id", paseoId)
      .not("receta_id", "is", null);

    if (!momentos || momentos.length === 0) {
      showError("Agrega recetas al menú del paseo primero.");
      setGeneratingPaseoId(null);
      return;
    }

    const recetaIds = [...new Set(momentos.map((m) => m.receta_id))];
    const { data: recetaIngs } = await supabase
      .from("receta_ingredientes")
      .select(
        "*, ingredientes(id, nombre, unidad_base, categoria, recomendaciones)",
      )
      .in("receta_id", recetaIds);

    const consolidated: Record<string, any> = {};
    for (const momento of momentos) {
      const porciones = momento.porciones ?? 1;
      const ings =
        recetaIngs?.filter((ri) => ri.receta_id === momento.receta_id) ?? [];
      for (const ing of ings) {
        const key = ing.ingrediente_id;
        const totalCantidad = ing.cantidad_por_porcion * porciones;
        if (consolidated[key]) {
          consolidated[key].cantidad += totalCantidad;
        } else {
          consolidated[key] = {
            ingrediente_id: ing.ingrediente_id,
            nombre: ing.ingredientes?.nombre ?? "",
            cantidad: totalCantidad,
            unidad: ing.ingredientes?.unidad_base ?? "",
            categoria: ing.ingredientes?.categoria ?? "Otros",
            recomendaciones: ing.ingredientes?.recomendaciones ?? "",
            es_extra: false,
            comprado: false,
          };
        }
      }
    }

    await supabase
      .from("lista_mercado")
      .delete()
      .eq("paseo_id", paseoId)
      .eq("es_extra", false);
    const rows = Object.values(consolidated).map((item) => ({
      ...item,
      paseo_id: paseoId,
      cantidad: Math.round(item.cantidad * 100) / 100,
    }));
    if (rows.length > 0) await supabase.from("lista_mercado").insert(rows);

    await loadAllItems();
    setGeneratingPaseoId(null);
  };

  const handleToggleComprado = async (item: any) => {
    const newValue = !item.comprado;
    setItemsPorPaseo((prev) => ({
      ...prev,
      [item.paseo_id]: prev[item.paseo_id].map((i) =>
        i.id === item.id ? { ...i, comprado: newValue } : i,
      ),
    }));
    await supabase
      .from("lista_mercado")
      .update({ comprado: newValue })
      .eq("id", item.id);
  };

  const handleAddExtra = async () => {
    if (!extraNombre.trim()) {
      showError("El nombre es obligatorio.");
      return;
    }
    setSavingExtra(true);
    const { error } = await supabase.from("lista_mercado").insert({
      paseo_id: addModalPaseoId,
      nombre: extraNombre.trim(),
      cantidad: extraCantidad ? parseFloat(extraCantidad) : null,
      unidad: extraUnidad.trim(),
      categoria: extraCategoria,
      recomendaciones: extraRecomendaciones.trim(),
      es_extra: true,
      comprado: false,
    });
    if (error) {
      showError(error.message);
    } else {
      setShowAddModal(false);
      setExtraNombre("");
      setBusquedaExtra("");
      setExtraCantidad("");
      setExtraUnidad("");
      setExtraRecomendaciones("");
      setExtraCategoria("Extras");
      await loadAllItems();
    }
    setSavingExtra(false);
  };

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    setShowDeleteModal(false);
    await supabase.from("lista_mercado").delete().eq("id", deleteTarget.id);
    await loadAllItems();
    setDeleteTarget(null);
  };

  const handleShare = async (paseoId: string) => {
    const paseo = paseos.find((p) => p.id === paseoId);
    const items = itemsPorPaseo[paseoId] ?? [];
    const categorias = [...new Set(items.map((i) => i.categoria))];
    let text = `🛒 Lista de mercado — ${paseo?.nombre}\n\n`;
    for (const cat of categorias) {
      const catItems = items.filter((i) => i.categoria === cat);
      const config = getCategoriaConfig(cat);
      text += `${config.icon} ${cat}\n`;
      for (const item of catItems) {
        const check = item.comprado ? "✓" : "○";
        const cantidad = item.cantidad ? `${item.cantidad} ${item.unidad}` : "";
        text += `  ${check} ${item.nombre}${cantidad ? " — " + cantidad : ""}\n`;
      }
      text += "\n";
    }
    await Share.share({ message: text });
  };

  const togglePaseo = (paseoId: string) => {
    setCollapsedPaseos((prev) => ({ ...prev, [paseoId]: !prev[paseoId] }));
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛒 Mercado</Text>
      </View>

      {loadingData ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B4F72" />
          <Text style={styles.loadingText}>Cargando listas...</Text>
        </View>
      ) : paseos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Sin paseos aún</Text>
          <Text style={styles.emptySub}>
            Crea un paseo para generar tu lista de mercado
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {paseos.map((paseo) => {
            const pid = paseo.id!;
            const items = itemsPorPaseo[pid] ?? [];
            const collapsed = collapsedPaseos[pid] ?? false;
            const comprados = items.filter((i) => i.comprado).length;
            const categorias = [
              ...new Set(items.map((i: any) => i.categoria)),
            ].sort() as string[];
            const isGenerating = generatingPaseoId === pid;

            return (
              <View key={pid} style={styles.paseoGroup}>
                {/* Paseo header */}
                <TouchableOpacity
                  style={styles.paseoHeader}
                  onPress={() => togglePaseo(pid)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paseoNombre}>{paseo.nombre}</Text>
                    <Text style={styles.paseoSub}>
                      {items.length === 0
                        ? "Sin items"
                        : `${comprados} de ${items.length} comprados`}
                    </Text>
                  </View>
                  {items.length > 0 && (
                    <View style={styles.paseoProgress}>
                      <Text style={styles.paseoProgressPct}>
                        {Math.round((comprados / items.length) * 100)}%
                      </Text>
                    </View>
                  )}
                  <Text style={styles.collapseIcon}>
                    {collapsed ? "▶" : "▼"}
                  </Text>
                </TouchableOpacity>

                {!collapsed && (
                  <View style={styles.paseoBody}>
                    {/* Progress bar */}
                    {items.length > 0 && (
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${(comprados / items.length) * 100}%` },
                          ]}
                        />
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => {
                          setConfirmGenerarPaseoId(pid);
                          setShowConfirmGenerar(true);
                        }}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.actionBtnPrimaryText}>
                            ⚡ Generar desde menú
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setAddModalPaseoId(pid);
                          setShowAddModal(true);
                        }}
                      >
                        <Text style={styles.actionBtnText}>+ Extra</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleShare(pid)}
                      >
                        <Text style={styles.actionBtnText}>📤</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Items */}
                    {items.length === 0 ? (
                      <View style={styles.emptyItems}>
                        <Text style={styles.emptyItemsText}>
                          Lista vacía — genera desde el menú o agrega items
                        </Text>
                      </View>
                    ) : (
                      categorias.map((cat) => {
                        const catItems = items.filter(
                          (i: any) => i.categoria === cat,
                        );
                        const config = getCategoriaConfig(cat);
                        return (
                          <View key={cat} style={styles.categorySection}>
                            <View style={styles.categoryHeader}>
                              <View
                                style={[
                                  styles.categoryBadge,
                                  { backgroundColor: config.bg },
                                ]}
                              >
                                <Text style={styles.categoryIcon}>
                                  {config.icon}
                                </Text>
                                <Text
                                  style={[
                                    styles.categoryLabel,
                                    { color: config.color },
                                  ]}
                                >
                                  {cat}
                                </Text>
                              </View>
                              <Text style={styles.categoryCount}>
                                {
                                  catItems.filter((i: any) => !i.comprado)
                                    .length
                                }{" "}
                                pendientes
                              </Text>
                            </View>

                            {catItems.map((item: any) => (
                              <TouchableOpacity
                                key={item.id}
                                style={[
                                  styles.itemRow,
                                  item.comprado && styles.itemRowComprado,
                                ]}
                                onPress={() => handleToggleComprado(item)}
                                onLongPress={() => {
                                  setOptionsTarget(item);
                                  setShowOptionsModal(true);
                                }}
                              >
                                {/* Checkbox */}
                                <View
                                  style={[
                                    styles.checkbox,
                                    item.comprado && styles.checkboxChecked,
                                  ]}
                                >
                                  {item.comprado && (
                                    <Text style={styles.checkmark}>✓</Text>
                                  )}
                                </View>

                                {/* Name + recomendaciones */}
                                <View style={styles.itemInfo}>
                                  <Text
                                    style={[
                                      styles.itemNombre,
                                      item.comprado &&
                                        styles.itemNombreComprado,
                                    ]}
                                  >
                                    {item.nombre}
                                    {item.es_extra && (
                                      <Text style={styles.extraTag}>
                                        {" "}
                                        extra
                                      </Text>
                                    )}
                                  </Text>
                                  {item.recomendaciones ? (
                                    <Text
                                      style={styles.itemRecom}
                                      numberOfLines={1}
                                    >
                                      {item.recomendaciones}
                                    </Text>
                                  ) : null}
                                </View>

                                {/* Cantidad — bold, right side */}
                                {item.cantidad ? (
                                  <Text
                                    style={[
                                      styles.itemCantidad,
                                      item.comprado &&
                                        styles.itemNombreComprado,
                                    ]}
                                  >
                                    {item.cantidad} {item.unidad}
                                  </Text>
                                ) : null}

                                {/* Recommendations icon if no recom shown inline */}
                                {item.recomendaciones ? (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setSelectedItem(item);
                                      setShowRecomModal(true);
                                    }}
                                  >
                                    <Text style={styles.recomIcon}>💡</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </TouchableOpacity>
                            ))}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ══════════════════════════════════════
          MODALS
      ══════════════════════════════════════ */}

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

      {/* Confirm generar */}
      <Modal
        visible={showConfirmGenerar}
        animationType="fade"
        transparent
        onRequestClose={() => setShowConfirmGenerar(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>⚡ Generar lista</Text>
            <Text style={styles.confirmMsg}>
              Esto generará la lista basada en el menú actual. Los items del
              menú existentes serán reemplazados.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#1B4F72" }]}
              onPress={() => handleGenerate(confirmGenerarPaseoId)}
            >
              <Text style={styles.confirmBtnText}>Generar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: "#e2e8f0", marginTop: 8 },
              ]}
              onPress={() => setShowConfirmGenerar(false)}
            >
              <Text style={[styles.confirmBtnText, { color: "#1e293b" }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Item options */}
      <Modal
        visible={showOptionsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{optionsTarget?.nombre}</Text>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: "#EFF6FF", marginBottom: 8 },
              ]}
              onPress={() => {
                setShowOptionsModal(false);
                setSelectedItem(optionsTarget);
                setShowRecomModal(true);
              }}
            >
              <Text style={[styles.confirmBtnText, { color: "#1B4F72" }]}>
                💡 Ver recomendaciones
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: "#FEE2E2", marginBottom: 8 },
              ]}
              onPress={() => {
                setShowOptionsModal(false);
                setDeleteTarget(optionsTarget);
                setShowDeleteModal(true);
              }}
            >
              <Text style={[styles.confirmBtnText, { color: "#DC2626" }]}>
                🗑️ Eliminar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#e2e8f0" }]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={[styles.confirmBtnText, { color: "#1e293b" }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>¿Eliminar item?</Text>
            <Text style={styles.confirmMsg}>
              "{deleteTarget?.nombre}" será eliminado de la lista.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
              onPress={confirmDeleteItem}
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

      {/* Recommendations */}
      <Modal
        visible={showRecomModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRecomModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.recomBox}>
            <Text style={styles.recomTitle}>💡 {selectedItem?.nombre}</Text>
            <Text style={styles.recomText}>
              {selectedItem?.recomendaciones ||
                "Sin recomendaciones disponibles."}
            </Text>
            {selectedItem?.cantidad && (
              <View style={styles.recomCantidad}>
                <Text style={styles.recomCantidadText}>
                  Cantidad: {selectedItem.cantidad} {selectedItem.unidad}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.recomClose}
              onPress={() => setShowRecomModal(false)}
            >
              <Text style={styles.recomCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add extra */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Agregar item extra</Text>
            <TouchableOpacity onPress={handleAddExtra} disabled={savingExtra}>
              <Text style={styles.modalSave}>
                {savingExtra ? "..." : "Agregar"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={busquedaExtra}
                onChangeText={(t) => {
                  setBusquedaExtra(t);
                  setExtraNombre(t);
                  setShowIngCatalogo(true);
                }}
                onFocus={() => setShowIngCatalogo(true)}
                placeholder="Buscar o escribir item..."
                placeholderTextColor="#94a3b8"
              />
              {showIngCatalogo &&
                busquedaExtra.length > 0 &&
                filteredIngCatalogo.length > 0 && (
                  <View style={styles.dropdown}>
                    {filteredIngCatalogo.slice(0, 6).map((ing) => (
                      <TouchableOpacity
                        key={ing.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setExtraNombre(ing.nombre);
                          setBusquedaExtra(ing.nombre);
                          setExtraUnidad(ing.unidad_base ?? "");
                          setExtraCategoria(ing.categoria ?? "Otros");
                          setExtraRecomendaciones(ing.recomendaciones ?? "");
                          setShowIngCatalogo(false);
                        }}
                      >
                        <Text style={styles.dropdownText}>{ing.nombre}</Text>
                        <Text style={styles.dropdownUnit}>
                          {ing.unidad_base}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Cantidad</Text>
                <TextInput
                  style={styles.input}
                  value={extraCantidad}
                  onChangeText={setExtraCantidad}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Unidad</Text>
                <TextInput
                  style={styles.input}
                  value={extraUnidad}
                  onChangeText={setExtraUnidad}
                  placeholder="Ej: rollos"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.chipRow}>
                {Object.keys(CATEGORIA_CONFIG).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      extraCategoria === cat && styles.chipActive,
                    ]}
                    onPress={() => setExtraCategoria(cat)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        extraCategoria === cat && styles.chipTextActive,
                      ]}
                    >
                      {CATEGORIA_CONFIG[cat].icon} {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Recomendaciones</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={extraRecomendaciones}
                onChangeText={setExtraRecomendaciones}
                placeholder="Marca, tamaño, frescura..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
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
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  emptySub: { fontSize: 14, color: "#94a3b8", textAlign: "center" },

  header: {
    backgroundColor: "#1B4F72",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

  content: { padding: 16, paddingBottom: 40 },

  // Paseo group
  paseoGroup: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  paseoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#1B4F72",
  },
  paseoNombre: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 2,
  },
  paseoSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  paseoProgress: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  paseoProgressPct: { color: "#fff", fontWeight: "800", fontSize: 13 },
  collapseIcon: { color: "rgba(255,255,255,0.8)", fontSize: 12 },

  paseoBody: { padding: 12 },

  progressTrack: {
    height: 5,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: { height: 5, backgroundColor: "#1B4F72", borderRadius: 3 },

  actionRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  actionBtnPrimary: {
    backgroundColor: "#1B4F72",
    borderColor: "#1B4F72",
    flex: 2,
  },
  actionBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionBtnText: { color: "#64748b", fontWeight: "600", fontSize: 13 },

  emptyItems: { paddingVertical: 20, alignItems: "center" },
  emptyItemsText: { fontSize: 13, color: "#94a3b8", textAlign: "center" },

  // Category
  categorySection: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryIcon: { fontSize: 14 },
  categoryLabel: { fontSize: 13, fontWeight: "700" },
  categoryCount: { fontSize: 11, color: "#94a3b8" },

  // Item row
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  itemRowComprado: { opacity: 0.45 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#1B4F72", borderColor: "#1B4F72" },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "800" },

  itemInfo: { flex: 1 },
  itemNombre: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemNombreComprado: { textDecorationLine: "line-through", color: "#94a3b8" },
  itemRecom: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  extraTag: { fontSize: 10, color: "#94a3b8", fontStyle: "italic" },

  // Cantidad — bold, right aligned
  itemCantidad: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    flexShrink: 0,
  },

  recomIcon: { fontSize: 18, marginLeft: 4 },

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

  recomBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  recomTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
  },
  recomText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 16,
  },
  recomCantidad: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  recomCantidadText: { fontSize: 14, color: "#1B4F72", fontWeight: "700" },
  recomClose: {
    backgroundColor: "#1B4F72",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  recomCloseText: { color: "#fff", fontWeight: "800", fontSize: 15 },

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
  field: { marginBottom: 14 },
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  chipActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#1B4F72" },

  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginTop: 4,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownText: { fontSize: 14, color: "#1e293b", fontWeight: "500" },
  dropdownUnit: { fontSize: 12, color: "#94a3b8" },
});
