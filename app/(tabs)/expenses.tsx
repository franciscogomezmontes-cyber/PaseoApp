import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
const CATEGORIAS = [
  { key: "comida", label: "🍽️ Comida", usaMomentos: true },
  { key: "alojamiento", label: "🏠 Alojamiento", usaMomentos: false },
  { key: "transporte", label: "🚗 Transporte", usaMomentos: false },
  { key: "alcohol", label: "🍺 Alcohol y Entret.", usaMomentos: false },
  { key: "otros", label: "📦 Otros", usaMomentos: false },
];

const ESTADO_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  planificacion: { color: "#92400E", bg: "#FEF3C7", label: "📋 Planificación" },
  activo: { color: "#065F46", bg: "#D1FAE5", label: "✅ Activo" },
  liquidado: { color: "#1D4ED8", bg: "#DBEAFE", label: "💸 Liquidado" },
};

const formatCOP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function GastosScreen() {
  const router = useRouter();
  const { paseos, fetchPaseos } = useTripStore();

  // ── Data ──
  const [gastosPorPaseo, setGastosPorPaseo] = useState<Record<string, any[]>>(
    {},
  );
  const [participacionesPorPaseo, setParticipacionesPorPaseo] = useState<
    Record<string, any[]>
  >({});
  const [personasPorPaseo, setPersonasPorPaseo] = useState<
    Record<string, any[]>
  >({});
  const [gastosPartMap, setGastosPartMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [familiasPorPaseo, setFamiliasPorPaseo] = useState<
    Record<string, any[]>
  >({});
  const [loadingData, setLoadingData] = useState(false);
  const [collapsedPaseos, setCollapsedPaseos] = useState<
    Record<string, boolean>
  >({});
  const [initialized, setInitialized] = useState(false);

  // ── Add/Edit gasto modal ──
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [editingGasto, setEditingGasto] = useState<any>(null);
  const [modalPaseoId, setModalPaseoId] = useState<string>("");
  const [gastoNombre, setGastoNombre] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [gastoCategoria, setGastoCategoria] = useState("comida");
  const [gastoPagadoPor, setGastoPagadoPor] = useState<string | null>(null);
  const [gastoParticipantes, setGastoParticipantes] = useState<
    Record<string, boolean>
  >({});
  const [savingGasto, setSavingGasto] = useState(false);

  // ── Options / delete modals ──
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsTarget, setOptionsTarget] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // ── Error modal ──
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  // ── Balances modal ──
  const [showBalancesModal, setShowBalancesModal] = useState(false);
  const [balancesPaseoId, setBalancesPaseoId] = useState<string>("");

  // ─────────────────────────────────────────────
  // Load all data
  // ─────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    if (paseos.length === 0) return;
    setLoadingData(true);

    const paseoIds = paseos.map((p) => p.id);

    // Load gastos
    const { data: gastosData } = await supabase
      .from("gastos")
      .select("*, personas(id, nombre)")
      .in("paseo_id", paseoIds)
      .order("created_at", { ascending: false });

    // Load participaciones
    const { data: partData } = await supabase
      .from("participaciones")
      .select("*, personas(id, nombre, foto_url)")
      .in("paseo_id", paseoIds);

    // Load familias
    const { data: familiasData } = await supabase
      .from("familias")
      .select("*")
      .in("paseo_id", paseoIds);

    const fxp: Record<string, any[]> = {};
    paseoIds.forEach((pid) => {
      fxp[pid] = [];
    });
    (familiasData ?? []).forEach((f: any) => {
      fxp[f.paseo_id]?.push(f);
    });
    setFamiliasPorPaseo(fxp);

    // Load participantes_gasto
    const gastoIds = (gastosData ?? []).map((g: any) => g.id);
    let partGastoRows: any[] = [];
    if (gastoIds.length > 0) {
      const { data } = await supabase
        .from("participantes_gasto")
        .select("*")
        .in("gasto_id", gastoIds);
      partGastoRows = data ?? [];
    }

    // Group by paseo
    const gxp: Record<string, any[]> = {};
    const pxp: Record<string, any[]> = {};
    const persxp: Record<string, any[]> = {};
    paseoIds.forEach((pid) => {
      gxp[pid] = [];
      pxp[pid] = [];
      persxp[pid] = [];
    });
    (gastosData ?? []).forEach((g: any) => {
      gxp[g.paseo_id]?.push(g);
    });
    (partData ?? []).forEach((p: any) => {
      pxp[p.paseo_id]?.push(p);
      if (!persxp[p.paseo_id]) persxp[p.paseo_id] = [];
      if (!persxp[p.paseo_id].find((x: any) => x.id === p.personas?.id)) {
        persxp[p.paseo_id].push(p.personas);
      }
    });

    // Build gastosPartMap
    const gpm: Record<string, Record<string, boolean>> = {};
    partGastoRows.forEach((r: any) => {
      if (!gpm[r.gasto_id]) gpm[r.gasto_id] = {};
      gpm[r.gasto_id][r.participacion_id] = r.activo;
    });

    setGastosPorPaseo(gxp);
    setParticipacionesPorPaseo(pxp);
    setPersonasPorPaseo(persxp);
    setGastosPartMap(gpm);
    setInitialized((prev) => {
      if (!prev) {
        // Collapse all paseos by default on first load
        const allCollapsed: Record<string, boolean> = {};
        paseoIds.forEach((pid) => {
          allCollapsed[pid] = true;
        });
        setCollapsedPaseos(allCollapsed);
      }
      return true;
    });
    setLoadingData(false);
  }, [paseos]);

  useFocusEffect(
    useCallback(() => {
      fetchPaseos().then(() => loadAllData());
    }, []),
  );

  useEffect(() => {
    loadAllData();
  }, [paseos]);

  // ─────────────────────────────────────────────
  // Modal helpers
  // ─────────────────────────────────────────────
  const openAddGasto = (paseoId: string) => {
    setEditingGasto(null);
    setModalPaseoId(paseoId);
    setGastoNombre("");
    setGastoMonto("");
    setGastoCategoria("comida");
    setGastoPagadoPor(null);
    // Init participantes all active
    const parts = participacionesPorPaseo[paseoId] ?? [];
    const map: Record<string, boolean> = {};
    parts.forEach((p) => {
      map[p.id] = true;
    });
    setGastoParticipantes(map);
    setShowGastoModal(true);
  };

  const openEditGasto = (g: any) => {
    setEditingGasto(g);
    setModalPaseoId(g.paseo_id);
    setGastoNombre(g.nombre);
    setGastoMonto(String(g.monto));
    setGastoCategoria(g.categoria ?? "comida");
    setGastoPagadoPor(g.pagado_por);
    const parts = participacionesPorPaseo[g.paseo_id] ?? [];
    const existing = gastosPartMap[g.id] ?? {};
    const map: Record<string, boolean> = {};
    parts.forEach((p) => {
      map[p.id] = existing[p.id] !== undefined ? existing[p.id] : true;
    });
    setGastoParticipantes(map);
    setShowGastoModal(true);
  };

  const closeGastoModal = () => {
    setShowGastoModal(false);
    setEditingGasto(null);
    setGastoNombre("");
    setGastoMonto("");
    setGastoCategoria("comida");
    setGastoPagadoPor(null);
    setGastoParticipantes({});
  };

  const handleSaveGasto = async () => {
    const monto = parseFloat(gastoMonto.replace(/\./g, "").replace(",", "."));
    if (!gastoNombre.trim()) {
      showError("Ingresa un nombre para el gasto.");
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      showError("Ingresa un monto válido.");
      return;
    }
    if (!gastoPagadoPor) {
      showError("Selecciona quién pagó.");
      return;
    }
    setSavingGasto(true);

    if (editingGasto) {
      const { error } = await supabase
        .from("gastos")
        .update({
          nombre: gastoNombre.trim(),
          monto,
          categoria: gastoCategoria,
          pagado_por: gastoPagadoPor,
        })
        .eq("id", editingGasto.id);
      if (error) {
        showError(error.message);
        setSavingGasto(false);
        return;
      }
      if (gastoCategoria !== "comida") {
        await supabase
          .from("participantes_gasto")
          .delete()
          .eq("gasto_id", editingGasto.id);
        const rows = (participacionesPorPaseo[modalPaseoId] ?? []).map((p) => ({
          gasto_id: editingGasto.id,
          participacion_id: p.id,
          activo:
            gastoParticipantes[p.id] !== undefined
              ? gastoParticipantes[p.id]
              : true,
        }));
        if (rows.length > 0)
          await supabase.from("participantes_gasto").insert(rows);
      }
    } else {
      const { data: newGasto, error } = await supabase
        .from("gastos")
        .insert({
          paseo_id: modalPaseoId,
          nombre: gastoNombre.trim(),
          monto,
          categoria: gastoCategoria,
          pagado_por: gastoPagadoPor,
        })
        .select()
        .single();
      if (error) {
        showError(error.message);
        setSavingGasto(false);
        return;
      }
      if (gastoCategoria !== "comida" && newGasto) {
        const rows = (participacionesPorPaseo[modalPaseoId] ?? []).map((p) => ({
          gasto_id: newGasto.id,
          participacion_id: p.id,
          activo:
            gastoParticipantes[p.id] !== undefined
              ? gastoParticipantes[p.id]
              : true,
        }));
        if (rows.length > 0)
          await supabase.from("participantes_gasto").insert(rows);
      }
    }

    closeGastoModal();
    await loadAllData();
    setSavingGasto(false);
  };

  const confirmDeleteGasto = async () => {
    if (!deleteTarget) return;
    setShowDeleteModal(false);
    const { error } = await supabase
      .from("gastos")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) showError(error.message);
    else await loadAllData();
    setDeleteTarget(null);
  };

  const togglePaseo = (paseoId: string) => {
    setCollapsedPaseos((prev) => ({ ...prev, [paseoId]: !prev[paseoId] }));
  };

  // ─────────────────────────────────────────────
  // Balances helpers (simplified for this tab)
  // ─────────────────────────────────────────────
  // Returns { balancePorFamilia, liquidaciones } — all grouped by familia
  const calcularBalancesFamilia = (paseoId: string) => {
    const gastos = gastosPorPaseo[paseoId] ?? [];
    const parts = participacionesPorPaseo[paseoId] ?? [];
    const familias = familiasPorPaseo[paseoId] ?? [];
    if (parts.length === 0) return { balancePorFamilia: [], liquidaciones: [] };

    // Build familia groups (include __sin_familia__ fallback)
    const famMap: Record<string, { id: string; nombre: string; parts: any[] }> =
      {};
    familias.forEach((f) => {
      famMap[f.id] = { id: f.id, nombre: f.nombre, parts: [] };
    });
    famMap["__sin_familia__"] = {
      id: "__sin_familia__",
      nombre: "Sin familia",
      parts: [],
    };
    parts.forEach((p) => {
      const fid = p.familia_id ?? "__sin_familia__";
      if (!famMap[fid])
        famMap[fid] = { id: fid, nombre: "Sin familia", parts: [] };
      famMap[fid].parts.push(p);
    });

    // puso per familia (gastos pagados by a member of that familia)
    const puso: Record<string, number> = {};
    Object.keys(famMap).forEach((fid) => {
      puso[fid] = 0;
    });
    gastos.forEach((g) => {
      const pagador = parts.find((p) => p.persona_id === g.pagado_por);
      if (!pagador) return;
      const fid = pagador.familia_id ?? "__sin_familia__";
      puso[fid] = (puso[fid] ?? 0) + g.monto;
    });

    // leCorresponde per familia — factor-weighted, per gasto
    const leCorresponde: Record<string, number> = {};
    Object.keys(famMap).forEach((fid) => {
      leCorresponde[fid] = 0;
    });
    gastos.forEach((g) => {
      const registros = gastosPartMap[g.id] ?? {};
      const noRegistros = Object.keys(registros).length === 0;
      const activosParts = parts.filter((p) =>
        noRegistros
          ? true
          : registros[p.id] !== undefined
            ? registros[p.id]
            : true,
      );
      const factorTotal = activosParts.reduce((s, p) => s + (p.factor ?? 1), 0);
      if (factorTotal === 0) return;
      // Group active parts by familia
      const factorPorFamilia: Record<string, number> = {};
      activosParts.forEach((p) => {
        const fid = p.familia_id ?? "__sin_familia__";
        factorPorFamilia[fid] = (factorPorFamilia[fid] ?? 0) + (p.factor ?? 1);
      });
      Object.entries(factorPorFamilia).forEach(([fid, factorFam]) => {
        leCorresponde[fid] =
          (leCorresponde[fid] ?? 0) + g.monto * (factorFam / factorTotal);
      });
    });

    const balancePorFamilia = Object.values(famMap)
      .filter((f) => f.parts.length > 0)
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        puso: puso[f.id] ?? 0,
        leCorresponde: leCorresponde[f.id] ?? 0,
        balance: (puso[f.id] ?? 0) - (leCorresponde[f.id] ?? 0),
      }));

    // Liquidaciones mínimas entre familias
    const deudores = balancePorFamilia
      .filter((f) => f.balance < -0.5)
      .map((f) => ({ ...f, monto: -f.balance }))
      .sort((a, b) => b.monto - a.monto);
    const acreedores = balancePorFamilia
      .filter((f) => f.balance > 0.5)
      .map((f) => ({ ...f, monto: f.balance }))
      .sort((a, b) => b.monto - a.monto);

    const liquidaciones: { de: string; para: string; monto: number }[] = [];
    let i = 0;
    let j = 0;
    while (i < deudores.length && j < acreedores.length) {
      const pago = Math.min(deudores[i].monto, acreedores[j].monto);
      if (pago > 0.5)
        liquidaciones.push({
          de: deudores[i].nombre,
          para: acreedores[j].nombre,
          monto: pago,
        });
      deudores[i].monto -= pago;
      acreedores[j].monto -= pago;
      if (deudores[i].monto < 0.5) i++;
      if (acreedores[j].monto < 0.5) j++;
    }

    return { balancePorFamilia, liquidaciones };
  };

  const calcularLiquidacionesPaseo = (paseoId: string) =>
    calcularBalancesFamilia(paseoId).liquidaciones;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const paseosFiltrados = paseos.filter(
    (p) => (gastosPorPaseo[p.id ?? ""]?.length ?? 0) > 0 || true,
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💸 Gastos</Text>
      </View>

      {loadingData ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1B4F72" />
          <Text style={styles.loadingText}>Cargando gastos...</Text>
        </View>
      ) : paseos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>Sin paseos aún</Text>
          <Text style={styles.emptySub}>
            Crea un paseo para empezar a registrar gastos
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push("/newTrip")}
          >
            <Text style={styles.ctaBtnText}>+ Crear paseo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {paseos.map((paseo) => {
            const pid = paseo.id ?? "";
            const gastos = gastosPorPaseo[pid] ?? [];
            const total = gastos.reduce((s, g) => s + g.monto, 0);
            const collapsed = collapsedPaseos[pid] ?? false;
            const estado =
              ESTADO_CONFIG[paseo.estado] ?? ESTADO_CONFIG["planificacion"];
            const liq = calcularLiquidacionesPaseo(pid);

            return (
              <View key={pid} style={styles.paseoGroup}>
                {/* Paseo header */}
                <TouchableOpacity
                  style={styles.paseoHeader}
                  onPress={() => togglePaseo(pid)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.paseoHeaderTop}>
                      <Text style={styles.paseoNombre}>{paseo.nombre}</Text>
                      <View
                        style={[
                          styles.estadoBadge,
                          { backgroundColor: estado.bg },
                        ]}
                      >
                        <Text
                          style={[styles.estadoText, { color: estado.color }]}
                        >
                          {estado.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.paseoSub}>
                      {gastos.length} gasto{gastos.length !== 1 ? "s" : ""} ·
                      Total: {formatCOP(total)}
                    </Text>
                  </View>
                  <Text style={styles.collapseIcon}>
                    {collapsed ? "▶" : "▼"}
                  </Text>
                </TouchableOpacity>

                {!collapsed && (
                  <View style={styles.paseoBody}>
                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => openAddGasto(pid)}
                      >
                        <Text style={styles.actionBtnText}>
                          + Agregar gasto
                        </Text>
                      </TouchableOpacity>
                      {gastos.length > 0 && (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnOutline]}
                          onPress={() => {
                            setBalancesPaseoId(pid);
                            setShowBalancesModal(true);
                          }}
                        >
                          <Text
                            style={[styles.actionBtnText, { color: "#1B4F72" }]}
                          >
                            ⚖️ Balances
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {paseo.estado === "liquidado" && (
                      <View
                        style={[
                          styles.liqPreview,
                          { backgroundColor: "#DBEAFE" },
                        ]}
                      >
                        <Text
                          style={[styles.liqPreviewTitle, { color: "#1D4ED8" }]}
                        >
                          💸 Paseo liquidado — todas las deudas saldadas
                        </Text>
                      </View>
                    )}

                    {/* Liquidaciones rápidas — solo si no está liquidado */}
                    {liq.length > 0 && paseo.estado !== "liquidado" && (
                      <View style={styles.liqPreview}>
                        <Text style={styles.liqPreviewTitle}>
                          💸 Liquidaciones pendientes
                        </Text>
                        {liq.slice(0, 2).map((t, i) => (
                          <Text key={i} style={styles.liqPreviewRow}>
                            {t.de} → {t.para}:{" "}
                            <Text style={{ fontWeight: "700" }}>
                              {formatCOP(t.monto)}
                            </Text>
                          </Text>
                        ))}
                        {liq.length > 2 && (
                          <TouchableOpacity
                            onPress={() => {
                              setBalancesPaseoId(pid);
                              setShowBalancesModal(true);
                            }}
                          >
                            <Text style={styles.liqPreviewMore}>
                              Ver todas ({liq.length}) →
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Gastos list */}
                    {gastos.length === 0 ? (
                      <View style={styles.emptyGastos}>
                        <Text style={styles.emptyGastosText}>
                          Sin gastos registrados
                        </Text>
                      </View>
                    ) : (
                      gastos.map((g) => {
                        const catLabel =
                          CATEGORIAS.find(
                            (c) => c.key === (g.categoria ?? "otros"),
                          )?.label ?? "📦 Otros";
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={styles.gastoCard}
                            onLongPress={() => {
                              setOptionsTarget(g);
                              setShowOptionsModal(true);
                            }}
                          >
                            <View style={styles.gastoCardLeft}>
                              <Text style={styles.gastoNombre}>{g.nombre}</Text>
                              <Text style={styles.gastoPagadoPor}>
                                Pagó: {g.personas?.nombre ?? "—"}
                              </Text>
                              <Text style={styles.gastoCat}>{catLabel}</Text>
                            </View>
                            <View style={styles.gastoCardRight}>
                              <Text style={styles.gastoMonto}>
                                {formatCOP(g.monto)}
                              </Text>
                              <Text style={styles.gastoHint}>
                                mantén para opciones
                              </Text>
                            </View>
                          </TouchableOpacity>
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

      {/* Options */}
      <Modal
        visible={showOptionsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>{optionsTarget?.nombre}</Text>
            <Text style={styles.optionsSub}>
              {CATEGORIAS.find(
                (c) => c.key === (optionsTarget?.categoria ?? "otros"),
              )?.label ?? "📦 Otros"}{" "}
              · {formatCOP(optionsTarget?.monto ?? 0)}
            </Text>
            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: "#EFF6FF" }]}
              onPress={() => {
                setShowOptionsModal(false);
                openEditGasto(optionsTarget);
              }}
            >
              <Text style={[styles.optionBtnText, { color: "#1B4F72" }]}>
                ✏️ Editar gasto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionBtn, { backgroundColor: "#FEE2E2" }]}
              onPress={() => {
                setShowOptionsModal(false);
                setDeleteTarget(optionsTarget);
                setShowDeleteModal(true);
              }}
            >
              <Text style={[styles.optionBtnText, { color: "#DC2626" }]}>
                🗑️ Eliminar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionCancel}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.optionCancelText}>Cancelar</Text>
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
            <Text style={styles.confirmTitle}>¿Eliminar gasto?</Text>
            <Text style={styles.confirmMsg}>
              "{deleteTarget?.nombre}" será eliminado permanentemente.
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
              onPress={confirmDeleteGasto}
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

      {/* Add / Edit gasto */}
      <Modal
        visible={showGastoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeGastoModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeGastoModal}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingGasto ? "Editar gasto" : "Agregar gasto"}
            </Text>
            <TouchableOpacity onPress={handleSaveGasto} disabled={savingGasto}>
              <Text style={styles.modalSave}>
                {savingGasto ? "..." : "Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Nombre */}
            <Text style={styles.fieldLabel}>Nombre del gasto</Text>
            <TextInput
              style={styles.input}
              value={gastoNombre}
              onChangeText={setGastoNombre}
              placeholder="ej. Supermercado, Gasolina..."
              placeholderTextColor="#94a3b8"
            />

            {/* Monto */}
            <Text style={styles.fieldLabel}>Monto (COP)</Text>
            <TextInput
              style={styles.input}
              value={gastoMonto}
              onChangeText={setGastoMonto}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
            />

            {/* Categoría */}
            <Text style={styles.fieldLabel}>Categoría</Text>
            <View style={styles.categoriasGrid}>
              {CATEGORIAS.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoriaBtn,
                    gastoCategoria === cat.key && styles.categoriaBtnActive,
                  ]}
                  onPress={() => setGastoCategoria(cat.key)}
                >
                  <Text
                    style={[
                      styles.categoriaBtnText,
                      gastoCategoria === cat.key &&
                        styles.categoriaBtnTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quién pagó */}
            <Text style={styles.fieldLabel}>¿Quién pagó?</Text>
            {(personasPorPaseo[modalPaseoId] ?? []).length === 0 ? (
              <Text style={styles.fieldHint}>
                No hay participantes en este paseo.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {(personasPorPaseo[modalPaseoId] ?? []).map((persona) => (
                  <TouchableOpacity
                    key={persona?.id}
                    style={[
                      styles.pagadorChip,
                      gastoPagadoPor === persona?.id &&
                        styles.pagadorChipActive,
                    ]}
                    onPress={() => setGastoPagadoPor(persona?.id)}
                  >
                    <Text
                      style={[
                        styles.pagadorChipText,
                        gastoPagadoPor === persona?.id &&
                          styles.pagadorChipTextActive,
                      ]}
                    >
                      {persona?.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Participantes (non-comida) */}
            {gastoCategoria !== "comida" &&
              (participacionesPorPaseo[modalPaseoId] ?? []).length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>
                    ¿Quiénes participan en este gasto?
                  </Text>
                  <Text style={styles.fieldHint}>
                    Desactiva quien no participa
                  </Text>
                  {(participacionesPorPaseo[modalPaseoId] ?? []).map((p) => (
                    <View key={p.id} style={styles.partRow}>
                      <Text style={styles.partNombre}>
                        {p.personas?.nombre}
                      </Text>
                      <Text style={styles.partFactor}>
                        factor {p.factor ?? 1}
                      </Text>
                      <Switch
                        value={
                          gastoParticipantes[p.id] !== undefined
                            ? gastoParticipantes[p.id]
                            : true
                        }
                        onValueChange={(v) =>
                          setGastoParticipantes((prev) => ({
                            ...prev,
                            [p.id]: v,
                          }))
                        }
                        trackColor={{ false: "#e2e8f0", true: "#1B4F72" }}
                        thumbColor="#fff"
                      />
                    </View>
                  ))}
                </>
              )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Balances modal */}
      <Modal
        visible={showBalancesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBalancesModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBalancesModal(false)}>
              <Text style={styles.modalCancel}>Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {paseos.find((p) => p.id === balancesPaseoId)?.nombre ??
                "Balances"}
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            {(() => {
              const gastos = gastosPorPaseo[balancesPaseoId] ?? [];
              const total = gastos.reduce((s, g) => s + g.monto, 0);
              const parts = participacionesPorPaseo[balancesPaseoId] ?? [];
              const { liquidaciones } =
                calcularBalancesFamilia(balancesPaseoId);

              // Balance por persona
              const balance: Record<string, number> = {};
              parts.forEach((p) => {
                balance[p.id] = 0;
              });
              gastos.forEach((g) => {
                const pagador = parts.find(
                  (p) => p.persona_id === g.pagado_por,
                );
                if (pagador) balance[pagador.id] += g.monto;
              });
              gastos.forEach((g) => {
                const registros = gastosPartMap[g.id] ?? {};
                const noRegistros = Object.keys(registros).length === 0;
                const activos = parts.filter((p) =>
                  noRegistros
                    ? true
                    : registros[p.id] !== undefined
                      ? registros[p.id]
                      : true,
                );
                const factorTotal = activos.reduce(
                  (s, p) => s + (p.factor ?? 1),
                  0,
                );
                activos.forEach((p) => {
                  balance[p.id] -=
                    factorTotal > 0
                      ? g.monto * ((p.factor ?? 1) / factorTotal)
                      : 0;
                });
              });

              return (
                <>
                  <Text style={styles.balancesTotal}>
                    Total gastos: {formatCOP(total)}
                  </Text>

                  <Text style={styles.balancesSectionTitle}>
                    Balance por persona
                  </Text>
                  {parts.map((p) => {
                    const b = balance[p.id] ?? 0;
                    const isPos = b >= 0;
                    return (
                      <View key={p.id} style={styles.balanceRow}>
                        <Text style={styles.balanceNombre}>
                          {p.personas?.nombre}
                        </Text>
                        <Text
                          style={[
                            styles.balanceVal,
                            { color: isPos ? "#16a34a" : "#DC2626" },
                          ]}
                        >
                          {isPos ? "+" : ""}
                          {formatCOP(b)}
                        </Text>
                      </View>
                    );
                  })}

                  <Text
                    style={[styles.balancesSectionTitle, { marginTop: 24 }]}
                  >
                    Liquidaciones
                  </Text>
                  {liquidaciones.length === 0 ? (
                    <Text style={styles.liqEmpty}>✅ ¡Todo cuadrado!</Text>
                  ) : (
                    liquidaciones.map((t, i) => (
                      <View key={i} style={styles.liqRow}>
                        <Text style={styles.liqDe}>{t.de}</Text>
                        <Text style={styles.liqArrow}>→</Text>
                        <Text style={styles.liqPara}>{t.para}</Text>
                        <Text style={styles.liqMonto}>
                          {formatCOP(t.monto)}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              );
            })()}
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
  header: {
    backgroundColor: "#1B4F72",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  loadingText: { color: "#64748b", marginTop: 12, fontSize: 14 },

  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 24,
    textAlign: "center",
  },
  ctaBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

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
  paseoHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  paseoNombre: { fontSize: 15, fontWeight: "800", color: "#fff", flex: 1 },
  paseoSub: { fontSize: 12, color: "rgba(255,255,255,0.75)" },
  estadoBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText: { fontSize: 10, fontWeight: "700" },
  collapseIcon: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginLeft: 8 },

  paseoBody: { padding: 12 },

  actionRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    backgroundColor: "#1B4F72",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnOutline: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#1B4F72",
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Liquidaciones preview
  liqPreview: {
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  liqPreviewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 6,
  },
  liqPreviewRow: { fontSize: 12, color: "#78350F", marginBottom: 2 },
  liqPreviewMore: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B4F72",
    marginTop: 4,
  },

  // Gasto card
  gastoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gastoCardLeft: { flex: 1 },
  gastoNombre: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  gastoPagadoPor: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  gastoCat: { fontSize: 11, color: "#94a3b8" },
  gastoCardRight: { alignItems: "flex-end" },
  gastoMonto: { fontSize: 15, fontWeight: "800", color: "#1B4F72" },
  gastoHint: { fontSize: 10, color: "#cbd5e1", marginTop: 2 },

  emptyGastos: { paddingVertical: 20, alignItems: "center" },
  emptyGastosText: { fontSize: 13, color: "#94a3b8" },

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

  optionsBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
    textAlign: "center",
  },
  optionsSub: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
    textAlign: "center",
  },
  optionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  optionBtnText: { fontWeight: "700", fontSize: 15 },
  optionCancel: { paddingVertical: 12, alignItems: "center" },
  optionCancelText: { fontSize: 14, color: "#94a3b8", fontWeight: "600" },

  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  modalCancel: { fontSize: 15, color: "#64748b", fontWeight: "600" },
  modalSave: { fontSize: 15, color: "#1B4F72", fontWeight: "800" },
  modalContent: { flex: 1, padding: 20 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 16,
  },
  fieldHint: { fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    fontSize: 15,
    color: "#1e293b",
    marginBottom: 4,
  },

  categoriasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  categoriaBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#f8fafc",
  },
  categoriaBtnActive: { backgroundColor: "#1B4F72", borderColor: "#1B4F72" },
  categoriaBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  categoriaBtnTextActive: { color: "#fff" },

  pagadorChip: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: "#f8fafc",
  },
  pagadorChipActive: { backgroundColor: "#1B4F72", borderColor: "#1B4F72" },
  pagadorChipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  pagadorChipTextActive: { color: "#fff" },

  partRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  partNombre: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" },
  partFactor: { fontSize: 12, color: "#94a3b8", marginRight: 12 },

  // Balances modal
  balancesTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B4F72",
    marginBottom: 16,
  },
  balancesSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#1B4F72",
    paddingBottom: 6,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  balanceNombre: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  balanceVal: { fontSize: 15, fontWeight: "800" },
  balanceFamiliaCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  balanceFamiliaTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  balanceFamiliaRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
  },
  balanceFamiliaItem: { flex: 1, alignItems: "center" },
  balanceFamiliaLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 2,
  },
  balanceFamiliaValue: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  balanceFamiliaDivider: { width: 1, backgroundColor: "#e2e8f0" },
  liqEmpty: {
    fontSize: 14,
    color: "#16a34a",
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 16,
  },
  liqRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 8,
  },
  liqDe: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  liqArrow: { fontSize: 16, color: "#94a3b8" },
  liqPara: { fontSize: 13, fontWeight: "700", color: "#16a34a", flex: 1 },
  liqMonto: { fontSize: 14, fontWeight: "800", color: "#1B4F72" },
});
