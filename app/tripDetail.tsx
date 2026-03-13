import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { useRecipeStore } from "../src/store/useRecipeStore";
import { useTripStore } from "../src/store/useTripStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const UF_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

const TIPOS_COMIDA = [
  "desayuno",
  "medias nueves",
  "almuerzo",
  "onces",
  "cena",
  "snack",
];
const TIPO_CONFIG: Record<
  string,
  { icon: string; color: string; bgColor: string }
> = {
  desayuno: { icon: "☀️", color: "#B45309", bgColor: "#FEF3C7" },
  "medias nueves": { icon: "🥪", color: "#92400E", bgColor: "#FEF3C7" },
  almuerzo: { icon: "🍽️", color: "#1D4ED8", bgColor: "#DBEAFE" },
  onces: { icon: "🍵", color: "#065F46", bgColor: "#D1FAE5" },
  cena: { icon: "🌙", color: "#6D28D9", bgColor: "#EDE9FE" },
  snack: { icon: "🥐", color: "#047857", bgColor: "#ECFDF5" },
};

const ESTADOS = ["planificacion", "activo", "liquidado"];
const ESTADO_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  planificacion: { color: "#92400E", bg: "#FEF3C7", label: "📋 Planificación" },
  activo: { color: "#065F46", bg: "#D1FAE5", label: "✅ Activo" },
  liquidado: { color: "#1D4ED8", bg: "#DBEAFE", label: "💸 Liquidado" },
};

const initials = (name: string) =>
  name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "??";

const extractCoordsFromLink = (
  link: string,
): { lat: number; lng: number } | null => {
  if (!link) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /\?q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /place\/(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = link.match(p);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
};

const formatCOP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    personas,
    fetchPersonas,
    crearPersona,
    agregarParticipacion,
    fetchPaseos,
  } = useTripStore();
  const { recetas, fetchRecetas } = useRecipeStore();

  // ── Core data ──
  const [activeTab, setActiveTab] = useState<
    "info" | "participantes" | "menu" | "gastos"
  >("info");
  const [paseo, setPaseo] = useState<any>(null);
  const [participaciones, setParticipaciones] = useState<any[]>([]);
  const [familiasList, setFamiliasList] = useState<any[]>([]);
  const [momentos, setMomentos] = useState<any[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [fechaActiva, setFechaActiva] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  // ── Info edit ──
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editLugar, setEditLugar] = useState("");
  const [editFechaInicio, setEditFechaInicio] = useState("");
  const [editFechaFin, setEditFechaFin] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editRecomendaciones, setEditRecomendaciones] = useState("");
  const [editLinkMapa, setEditLinkMapa] = useState("");
  const [editFotoUrl, setEditFotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // ── Familia edit modal ──
  const [showEditFamiliaModal, setShowEditFamiliaModal] = useState(false);
  const [editingFamilia, setEditingFamilia] = useState<any>(null);
  const [editFamiliaNombre, setEditFamiliaNombre] = useState("");
  const [uploadingFamiliaPhoto, setUploadingFamiliaPhoto] = useState(false);

  // ── Add participant ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [personaSearch, setPersonaSearch] = useState("");
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(
    null,
  );
  const [newPersonaNombre, setNewPersonaNombre] = useState("");
  // familia selection inside add modal
  const [selectedFamiliaId, setSelectedFamiliaId] = useState<string | null>(
    null,
  );
  const [creatingNewFamilia, setCreatingNewFamilia] = useState(false);
  const [newFamiliaNombre, setNewFamiliaNombre] = useState("");
  // factor
  const [factorInput, setFactorInput] = useState("1.0");
  const [savingParticipant, setSavingParticipant] = useState(false);

  // ── Participant options / edit ──
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsParticipante, setOptionsParticipante] = useState<any>(null);
  const [showFactorModal, setShowFactorModal] = useState(false);
  const [factorParticipante, setFactorParticipante] = useState<any>(null);
  const [factorEditInput, setFactorEditInput] = useState("1.0");
  const [showMoveFamiliaModal, setShowMoveFamiliaModal] = useState(false);
  const [movingParticipante, setMovingParticipante] = useState<any>(null);
  const [showDeletePartModal, setShowDeletePartModal] = useState(false);
  const [deletePartTarget, setDeletePartTarget] = useState<any>(null);

  // ── Meal ──
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState("almuerzo");
  const [selectedRecetaId, setSelectedRecetaId] = useState<string | null>(null);
  const [savingMeal, setSavingMeal] = useState(false);
  const [showMealOptionsModal, setShowMealOptionsModal] = useState(false);
  // Meal modal search/filters
  const [mealSearch, setMealSearch] = useState("");
  const [mealFilterKeyword, setMealFilterKeyword] = useState<string | null>(
    null,
  );
  const [mealFilterCategoria, setMealFilterCategoria] = useState<string | null>(
    null,
  );
  const [mealFilterDieta, setMealFilterDieta] = useState<string | null>(null);
  const [mealOptionsTarget, setMealOptionsTarget] = useState<any>(null);
  const [showEditMealModal, setShowEditMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<any>(null);
  const [editMealTipo, setEditMealTipo] = useState("almuerzo");
  const [showDeleteMealModal, setShowDeleteMealModal] = useState(false);
  const [deleteMealId, setDeleteMealId] = useState<string | null>(null);

  // ── Meal detail / participantes por comida ──
  const [showMealDetailModal, setShowMealDetailModal] = useState(false);
  const [mealDetailTarget, setMealDetailTarget] = useState<any>(null);
  // participacionId → activo
  const [participantesComida, setParticipantesComida] = useState<
    Record<string, boolean>
  >({});
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const savingToggleRef = useRef<Record<string, boolean>>({});

  // ── Misc modals ──
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [showDeleteTripModal, setShowDeleteTripModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ── Gastos ──
  const [gastos, setGastos] = useState<any[]>([]);
  const [gastosTab, setGastosTab] = useState<
    "gastos" | "balances" | "liquidar"
  >("gastos");
  const [showAddGastoModal, setShowAddGastoModal] = useState(false);
  const [gastoNombre, setGastoNombre] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [gastoCategoria, setGastoCategoria] = useState("comida");
  const [gastoPagadoPor, setGastoPagadoPor] = useState<string | null>(null);
  const [savingGasto, setSavingGasto] = useState(false);
  const [showDeleteGastoModal, setShowDeleteGastoModal] = useState(false);
  const [deleteGastoTarget, setDeleteGastoTarget] = useState<any>(null);
  const [showGastoOptionsModal, setShowGastoOptionsModal] = useState(false);
  const [gastoOptionsTarget, setGastoOptionsTarget] = useState<any>(null);
  const [editingGasto, setEditingGasto] = useState<any>(null); // null = creating, object = editing
  const [exportando, setExportando] = useState(false);
  const [liquidacionesPagadas, setLiquidacionesPagadas] = useState<
    Record<string, boolean>
  >({}); // key: `${deFamId}_${paraFamId}`
  const [savingLiquidacion, setSavingLiquidacion] = useState(false);
  const [participantesComidaMap, setParticipantesComidaMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  // gastoId → { participacionId → activo }
  const [gastosPartMap, setGastosPartMap] = useState<
    Record<string, Record<string, boolean>>
  >({});
  // participacionId → activo, for the gasto being created
  const [gastoParticipantes, setGastoParticipantes] = useState<
    Record<string, boolean>
  >({});

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  const familiaForPart = (p: any) =>
    familiasList.find((f) => f.id === p.familia_id) ?? null;

  const colorForFamilia = (familiaId: string | null) => {
    const idx = familiasList.findIndex((f) => f.id === familiaId);
    return UF_COLORS[idx >= 0 ? idx % UF_COLORS.length : 0];
  };

  // ─────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────
  useEffect(() => {
    fetchPersonas();
    fetchRecetas();
    loadTripData();
  }, [id]);
  useEffect(() => {
    if (activeTab === "gastos") {
      loadGastos();
      loadParticipantesComidaMap(momentos);
      loadLiquidacionesPagadas();
    }
  }, [activeTab]);

  const loadTripData = async () => {
    setLoading(true);
    const { data: paseoData } = await supabase
      .from("paseos")
      .select("*")
      .eq("id", id)
      .single();
    if (paseoData) {
      setPaseo(paseoData);
      setEditNombre(paseoData.nombre ?? "");
      setEditLugar(paseoData.lugar ?? "");
      setEditFechaInicio(paseoData.fecha_inicio ?? "");
      setEditFechaFin(paseoData.fecha_fin ?? "");
      setEditLink(paseoData.link_alojamiento ?? "");
      setEditRecomendaciones(paseoData.recomendaciones ?? "");
      setEditLinkMapa(paseoData.link_mapa ?? "");
      setEditFotoUrl(paseoData.foto_url ?? "");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsOrganizer(paseoData.organizer_id === user?.id);
      const dates: string[] = [];
      const start = new Date(paseoData.fecha_inicio + "T12:00:00");
      const end = new Date(paseoData.fecha_fin + "T12:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1))
        dates.push(d.toISOString().split("T")[0]);
      setFechas(dates);
      setFechaActiva(dates[0] ?? null);
    }
    const { data: famData } = await supabase
      .from("familias")
      .select("*")
      .eq("paseo_id", id)
      .order("numero");
    setFamiliasList(famData ?? []);

    const { data: partData } = await supabase
      .from("participaciones")
      .select("*, personas(nombre, auth_user_id, foto_url)")
      .eq("paseo_id", id)
      .order("familia_id");
    setParticipaciones(partData ?? []);

    const { data: momentosData } = await supabase
      .from("momentos_comida")
      .select("*, recetas(id, nombre)")
      .eq("paseo_id", id)
      .order("fecha")
      .order("tipo_comida");
    setMomentos(momentosData ?? []);
    await loadParticipantesComidaMap(momentosData ?? []);
    setLoading(false);
  };

  const loadGastos = async () => {
    const { data } = await supabase
      .from("gastos")
      .select("*, personas(nombre)")
      .eq("paseo_id", id)
      .order("created_at", { ascending: false });
    const gastosList = data ?? [];
    setGastos(gastosList);

    // Load participantes_gasto for all non-comida gastos
    const nonComidaIds = gastosList
      .filter((g: any) => g.categoria !== "comida")
      .map((g: any) => g.id);
    if (nonComidaIds.length > 0) {
      const { data: partData } = await supabase
        .from("participantes_gasto")
        .select("gasto_id, participacion_id, activo")
        .in("gasto_id", nonComidaIds);
      const map: Record<string, Record<string, boolean>> = {};
      (partData ?? []).forEach((r: any) => {
        if (!map[r.gasto_id]) map[r.gasto_id] = {};
        map[r.gasto_id][r.participacion_id] = r.activo;
      });
      setGastosPartMap(map);
    } else {
      setGastosPartMap({});
    }
  };

  const loadParticipantesComidaMap = async (momentosList: any[]) => {
    if (momentosList.length === 0) {
      setParticipantesComidaMap({});
      return;
    }
    const { data } = await supabase
      .from("participantes_comida")
      .select("momento_id, participacion_id, activo")
      .in(
        "momento_id",
        momentosList.map((m: any) => m.id),
      );
    const map: Record<string, Record<string, boolean>> = {};
    (data ?? []).forEach((r: any) => {
      if (!map[r.momento_id]) map[r.momento_id] = {};
      map[r.momento_id][r.participacion_id] = r.activo;
    });
    setParticipantesComidaMap(map);
  };

  // ─────────────────────────────────────────────
  // Meal detail / participantes por comida
  // ─────────────────────────────────────────────
  const openMealDetail = async (meal: any) => {
    setMealDetailTarget(meal);
    setShowMealDetailModal(true);
    setLoadingParticipantes(true);

    // Load existing records
    const { data: existing } = await supabase
      .from("participantes_comida")
      .select("*")
      .eq("momento_id", meal.id);

    const existingMap: Record<string, boolean> = {};
    (existing ?? []).forEach((r: any) => {
      existingMap[r.participacion_id] = r.activo;
    });

    // For participants not yet in the table, default to true (insert on first toggle)
    const map: Record<string, boolean> = {};
    participaciones.forEach((p) => {
      map[p.id] = existingMap[p.id] !== undefined ? existingMap[p.id] : true;
    });
    setParticipantesComida(map);
    setLoadingParticipantes(false);
  };

  const toggleParticipante = async (
    participacionId: string,
    currentValue: boolean,
  ) => {
    if (savingToggleRef.current[participacionId]) return;
    savingToggleRef.current[participacionId] = true;
    const newValue = !currentValue;
    setParticipantesComida((prev) => ({
      ...prev,
      [participacionId]: newValue,
    }));

    const { data: existing } = await supabase
      .from("participantes_comida")
      .select("id")
      .eq("momento_id", mealDetailTarget.id)
      .eq("participacion_id", participacionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("participantes_comida")
        .update({ activo: newValue })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("participantes_comida")
        .insert({
          momento_id: mealDetailTarget.id,
          participacion_id: participacionId,
          activo: newValue,
        });
    }

    // Update porciones on momentos_comida based on active participants
    const updatedMap = { ...participantesComida, [participacionId]: newValue };
    const activePorciones = participaciones
      .filter((p) => updatedMap[p.id] !== false)
      .reduce((sum, p) => sum + (p.factor ?? 1), 0);
    await supabase
      .from("momentos_comida")
      .update({ porciones: Math.round(activePorciones * 10) / 10 })
      .eq("id", mealDetailTarget.id);

    savingToggleRef.current[participacionId] = false;
  };

  // Active count for a meal
  const activosEnComida = (mealId: string) => {
    // If no records exist yet, all are active
    return participaciones.length;
  };

  // ─────────────────────────────────────────────
  // Familia handlers
  // ─────────────────────────────────────────────
  const openEditFamilia = (familia: any) => {
    setEditingFamilia(familia);
    setEditFamiliaNombre(familia.nombre);
    setShowEditFamiliaModal(true);
  };

  const saveEditFamilia = async () => {
    if (!editingFamilia || !editFamiliaNombre.trim()) return;
    const { error } = await supabase
      .from("familias")
      .update({ nombre: editFamiliaNombre.trim() })
      .eq("id", editingFamilia.id);
    if (error) showError(error.message);
    else {
      setShowEditFamiliaModal(false);
      loadTripData();
    }
  };

  const pickFamiliaPhoto = async () => {
    if (!editingFamilia) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploadingFamiliaPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const fileName = `familia_${editingFamilia.id}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) {
        showError(uploadError.message);
        setUploadingFamiliaPhoto(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      await supabase
        .from("familias")
        .update({ foto_url: publicUrl })
        .eq("id", editingFamilia.id);
      setEditingFamilia((prev: any) => ({ ...prev, foto_url: publicUrl }));
      loadTripData();
    } catch (e) {
      showError("No se pudo procesar la imagen.");
    }
    setUploadingFamiliaPhoto(false);
  };

  // ─────────────────────────────────────────────
  // Participant handlers
  // ─────────────────────────────────────────────
  const handleAddParticipant = async () => {
    setSavingParticipant(true);
    let personaId = selectedPersonaId;
    if (addingNew && newPersonaNombre.trim()) {
      const nueva = await crearPersona(newPersonaNombre.trim());
      if (!nueva) {
        showError("No se pudo crear la persona.");
        setSavingParticipant(false);
        return;
      }
      personaId = nueva.id;
    }
    if (!personaId) {
      showError("Selecciona o crea una persona.");
      setSavingParticipant(false);
      return;
    }

    // Resolve familia
    let familiaId = selectedFamiliaId;
    if (creatingNewFamilia && newFamiliaNombre.trim()) {
      const nextNumero =
        (familiasList.length > 0
          ? Math.max(...familiasList.map((f) => f.numero))
          : 0) + 1;
      const { data: newFam, error: famErr } = await supabase
        .from("familias")
        .insert({
          paseo_id: id,
          nombre: newFamiliaNombre.trim(),
          numero: nextNumero,
        })
        .select()
        .single();
      if (famErr || !newFam) {
        showError("No se pudo crear la familia.");
        setSavingParticipant(false);
        return;
      }
      familiaId = newFam.id;
    }
    if (!familiaId) {
      showError("Selecciona o crea una familia.");
      setSavingParticipant(false);
      return;
    }

    const parsedFactor = Math.min(1, Math.max(0, parseFloat(factorInput) || 1));
    // Get unidad_familiar number from familia
    const famObj =
      familiasList.find((f) => f.id === familiaId) ??
      (creatingNewFamilia
        ? {
            numero:
              (familiasList.length > 0
                ? Math.max(...familiasList.map((f) => f.numero))
                : 0) + 1,
          }
        : { numero: 1 });

    const { error } = await supabase.from("participaciones").insert({
      paseo_id: id,
      persona_id: personaId,
      familia_id: familiaId,
      unidad_familiar: famObj.numero,
      factor: parsedFactor,
      puso: 0,
    });
    if (error) {
      showError(error.message);
      setSavingParticipant(false);
      return;
    }

    // Reset
    setSelectedPersonaId(null);
    setPersonaSearch("");
    setNewPersonaNombre("");
    setSelectedFamiliaId(null);
    setCreatingNewFamilia(false);
    setNewFamiliaNombre("");
    setFactorInput("1.0");
    setAddingNew(false);
    setShowAddModal(false);
    setSavingParticipant(false);
    loadTripData();
  };

  const handleParticipanteOptions = (m: any) => {
    setOptionsParticipante(m);
    setShowOptionsModal(true);
  };

  const handleChangeFactor = (m: any) => {
    setFactorParticipante(m);
    setFactorEditInput(String(m.factor ?? 1));
    setShowFactorModal(true);
  };

  const applyFactor = async () => {
    if (!factorParticipante) return;
    const v = Math.min(1, Math.max(0, parseFloat(factorEditInput) || 1));
    setShowFactorModal(false);
    const { error } = await supabase
      .from("participaciones")
      .update({ factor: v })
      .eq("id", factorParticipante.id);
    if (error) showError(error.message);
    else loadTripData();
  };

  const handleMoveToFamilia = (m: any) => {
    setMovingParticipante(m);
    setShowMoveFamiliaModal(true);
  };

  const applyMoveFamilia = async (familiaId: string) => {
    if (!movingParticipante) return;
    setShowMoveFamiliaModal(false);
    const famObj = familiasList.find((f) => f.id === familiaId);
    const { error } = await supabase
      .from("participaciones")
      .update({ familia_id: familiaId, unidad_familiar: famObj?.numero ?? 1 })
      .eq("id", movingParticipante.id);
    if (error) showError(error.message);
    else loadTripData();
  };

  const handleDeleteParticipante = (m: any) => {
    setDeletePartTarget(m);
    setShowDeletePartModal(true);
  };
  const confirmDeleteParticipante = async () => {
    if (!deletePartTarget) return;
    setShowDeletePartModal(false);
    const { error } = await supabase
      .from("participaciones")
      .delete()
      .eq("id", deletePartTarget.id);
    if (error) showError(error.message);
    else loadTripData();
  };

  // ─────────────────────────────────────────────
  // Meal handlers
  // ─────────────────────────────────────────────
  const handleMealOptions = (m: any) => {
    setMealOptionsTarget(m);
    setShowMealOptionsModal(true);
  };

  const handleAddMeal = async () => {
    if (!fechaActiva) return;
    setSavingMeal(true);
    const currentFecha = fechaActiva;
    const totalFactor = participaciones.reduce(
      (sum, p) => sum + (p.factor ?? 1),
      0,
    );
    const { error } = await supabase.from("momentos_comida").insert({
      paseo_id: id,
      fecha: currentFecha,
      tipo_comida: selectedTipo,
      receta_id: selectedRecetaId,
      porciones: Math.round(totalFactor * 10) / 10 || 1,
    });
    if (error) showError(error.message);
    else {
      setShowAddMealModal(false);
      setSelectedRecetaId(null);
      await loadTripData();
      setFechaActiva(currentFecha);
    }
    setSavingMeal(false);
  };

  const handleSaveEditMeal = async () => {
    if (!editingMeal) return;
    const { error } = await supabase
      .from("momentos_comida")
      .update({ tipo_comida: editMealTipo })
      .eq("id", editingMeal.id);
    if (error) showError(error.message);
    else {
      setShowEditMealModal(false);
      const cf = fechaActiva;
      await loadTripData();
      setFechaActiva(cf);
    }
  };

  const handleDeleteMeal = (mealId: string) => {
    setDeleteMealId(mealId);
    setShowDeleteMealModal(true);
  };
  const confirmDeleteMeal = async () => {
    if (!deleteMealId) return;
    setShowDeleteMealModal(false);
    const { error } = await supabase
      .from("momentos_comida")
      .delete()
      .eq("id", deleteMealId);
    if (error) showError(error.message);
    else loadTripData();
  };

  // ─────────────────────────────────────────────
  // Info / trip handlers
  // ─────────────────────────────────────────────
  const handleSaveInfo = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("paseos")
      .update({
        nombre: editNombre,
        lugar: editLugar,
        fecha_inicio: editFechaInicio,
        fecha_fin: editFechaFin,
        link_alojamiento: editLink,
        recomendaciones: editRecomendaciones,
        link_mapa: editLinkMapa,
        foto_url: editFotoUrl,
      })
      .eq("id", id);
    if (error) showError(error.message);
    else {
      setEditing(false);
      loadTripData();
    }
    setSaving(false);
  };

  const handleChangeEstado = async (estado: string) => {
    const { error } = await supabase
      .from("paseos")
      .update({ estado })
      .eq("id", id);
    if (error) showError(error.message);
    else {
      setShowEstadoModal(false);
      setPaseo((prev: any) => ({ ...prev, estado }));
      loadTripData();
    }
  };

  const handleDeleteTrip = async () => {
    setShowDeleteTripModal(false);
    const { error } = await supabase.from("paseos").delete().eq("id", id);
    if (error) {
      showError("No se pudo eliminar el paseo: " + error.message);
      return;
    }
    await fetchPaseos();
    router.replace("/(tabs)/trips");
  };

  const pickTripPhoto = async (source: "camera" | "gallery") => {
    setShowPhotoModal(false);
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
    }
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const fileName = `trip_${id}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, arrayBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) {
        showError(uploadError.message);
        setUploadingPhoto(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      setEditFotoUrl(publicUrl);
      await supabase
        .from("paseos")
        .update({ foto_url: publicUrl })
        .eq("id", id);
      loadTripData();
    } catch (e) {
      showError("No se pudo procesar la imagen.");
    }
    setUploadingPhoto(false);
  };

  // ─────────────────────────────────────────────
  // Gastos handlers & calculations
  // ─────────────────────────────────────────────
  // Init all participants as active for the gasto being created
  const initGastoParticipantes = () => {
    const map: Record<string, boolean> = {};
    participaciones.forEach((p) => {
      map[p.id] = true;
    });
    setGastoParticipantes(map);
  };

  // Derived: for the add-gasto modal, treat missing keys as true
  const gastoPartActivoForModal = (participacionId: string) =>
    gastoParticipantes[participacionId] !== false;

  const confirmDeleteGasto = async () => {
    if (!deleteGastoTarget) return;
    setShowDeleteGastoModal(false);
    const { error } = await supabase
      .from("gastos")
      .delete()
      .eq("id", deleteGastoTarget.id);
    if (error) showError(error.message);
    else loadGastos();
  };

  const openEditGasto = async (g: any) => {
    setEditingGasto(g);
    setGastoNombre(g.nombre);
    setGastoMonto(String(g.monto));
    setGastoCategoria(g.categoria ?? "comida");
    setGastoPagadoPor(g.pagado_por);
    // Load existing participantes for this gasto
    if (g.categoria !== "comida") {
      const existing = gastosPartMap[g.id] ?? {};
      const map: Record<string, boolean> = {};
      participaciones.forEach((p) => {
        map[p.id] = existing[p.id] !== undefined ? existing[p.id] : true;
      });
      setGastoParticipantes(map);
    } else {
      setGastoParticipantes({});
    }
    setShowAddGastoModal(true);
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
      // UPDATE
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

      // Update participantes_gasto if non-comida
      if (gastoCategoria !== "comida") {
        await supabase
          .from("participantes_gasto")
          .delete()
          .eq("gasto_id", editingGasto.id);
        const rows = participaciones.map((p) => ({
          gasto_id: editingGasto.id,
          participacion_id: p.id,
          activo:
            gastoParticipantes[p.id] !== undefined
              ? gastoParticipantes[p.id]
              : true,
        }));
        await supabase.from("participantes_gasto").insert(rows);
      }
    } else {
      // INSERT
      const { data: newGasto, error } = await supabase
        .from("gastos")
        .insert({
          paseo_id: id,
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
        const rows = participaciones.map((p) => ({
          gasto_id: newGasto.id,
          participacion_id: p.id,
          activo:
            gastoParticipantes[p.id] !== undefined
              ? gastoParticipantes[p.id]
              : true,
        }));
        await supabase.from("participantes_gasto").insert(rows);
      }
    }

    setGastoNombre("");
    setGastoMonto("");
    setGastoCategoria("comida");
    setGastoPagadoPor(null);
    setGastoParticipantes({});
    setEditingGasto(null);
    setShowAddGastoModal(false);
    loadGastos();
    setSavingGasto(false);
  };

  // ─────────────────────────────────────────────
  // Gastos calculations — by category
  // ─────────────────────────────────────────────

  const CATEGORIAS = [
    { key: "comida", label: "🍽️ Comida", usaMomentos: true },
    { key: "alojamiento", label: "🏠 Alojamiento", usaMomentos: false },
    { key: "transporte", label: "🚗 Transporte", usaMomentos: false },
    { key: "alcohol", label: "🍺 Alcohol y Entret.", usaMomentos: false },
    { key: "otros", label: "📦 Otros", usaMomentos: false },
  ];

  // For a given familia and category, calculate how much they owe
  const leCorrespondePorCategoria = (
    familiaId: string,
    categoria: string,
    usaMomentos: boolean,
  ): number => {
    const miembros =
      familiaId === "__sin_familia__"
        ? participaciones.filter((p) => !p.familia_id)
        : participaciones.filter((p) => p.familia_id === familiaId);

    const gastosCat = gastos.filter((g) => g.categoria === categoria);
    if (gastosCat.length === 0) return 0;

    if (usaMomentos && momentos.length > 0) {
      // COMIDA: per-meal split weighted by active factor per moment
      const totalCat = gastosCat.reduce((sum, g) => sum + g.monto, 0);
      const costoPorMomento = totalCat / momentos.length;
      let total = 0;
      momentos.forEach((m) => {
        const registros = participantesComidaMap[m.id] ?? {};
        const factorActivoFamilia = miembros.reduce((sum, p) => {
          const activo = registros[p.id] !== undefined ? registros[p.id] : true;
          return sum + (activo ? (p.factor ?? 1) : 0);
        }, 0);
        const factorActivoTotal = participaciones.reduce((sum, p) => {
          const activo =
            (participantesComidaMap[m.id] ?? {})[p.id] !== undefined
              ? (participantesComidaMap[m.id] ?? {})[p.id]
              : true;
          return sum + (activo ? (p.factor ?? 1) : 0);
        }, 0);
        if (factorActivoTotal > 0)
          total += costoPorMomento * (factorActivoFamilia / factorActivoTotal);
      });
      return total;
    }

    // NON-COMIDA: each gasto has its own participant list
    let total = 0;
    gastosCat.forEach((g) => {
      const registros = gastosPartMap[g.id] ?? {};
      // If no records saved yet, everyone participates (shouldn't happen but safe fallback)
      const allActive = Object.keys(registros).length === 0;

      const factorActivoFamilia = miembros.reduce((sum, p) => {
        const activo = allActive
          ? true
          : registros[p.id] !== undefined
            ? registros[p.id]
            : true;
        return sum + (activo ? (p.factor ?? 1) : 0);
      }, 0);
      const factorActivoTotal = participaciones.reduce((sum, p) => {
        const activo = allActive
          ? true
          : registros[p.id] !== undefined
            ? registros[p.id]
            : true;
        return sum + (activo ? (p.factor ?? 1) : 0);
      }, 0);
      if (factorActivoTotal > 0)
        total += g.monto * (factorActivoFamilia / factorActivoTotal);
    });
    return total;
  };

  // Returns per-familia balance data grouped by category
  const calcularBalancesPorCategoria = () => {
    const personaToFamiliaId: Record<string, string> = {};
    participaciones.forEach((p) => {
      personaToFamiliaId[p.persona_id] = p.familia_id ?? "__sin_familia__";
    });

    // Build familia list
    const famIds: { id: string; nombre: string; factorTotal: number }[] = [];
    familiasList.forEach((fam) => {
      const miembros = participaciones.filter((p) => p.familia_id === fam.id);
      if (miembros.length === 0) return;
      famIds.push({
        id: fam.id,
        nombre: fam.nombre,
        factorTotal: miembros.reduce((s, p) => s + (p.factor ?? 1), 0),
      });
    });
    const sinFam = participaciones.filter((p) => !p.familia_id);
    if (sinFam.length > 0)
      famIds.push({
        id: "__sin_familia__",
        nombre: "Sin familia",
        factorTotal: sinFam.reduce((s, p) => s + (p.factor ?? 1), 0),
      });

    // puso por familia
    const pusoMap: Record<string, number> = {};
    famIds.forEach((f) => {
      pusoMap[f.id] = 0;
    });
    gastos.forEach((g) => {
      const fId = personaToFamiliaId[g.pagado_por];
      if (fId && pusoMap[fId] !== undefined) pusoMap[fId] += g.monto;
    });

    // leCorresponde total (sum across categories)
    const leCorrespondeMap: Record<string, number> = {};
    famIds.forEach((f) => {
      leCorrespondeMap[f.id] = CATEGORIAS.reduce((sum, cat) => {
        const hasCat = gastos.some((g) => g.categoria === cat.key);
        return (
          sum +
          (hasCat
            ? leCorrespondePorCategoria(f.id, cat.key, cat.usaMomentos)
            : 0)
        );
      }, 0);
    });

    return famIds.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      factorTotal: f.factorTotal,
      puso: pusoMap[f.id] ?? 0,
      leCorresponde: leCorrespondeMap[f.id] ?? 0,
      balance: (pusoMap[f.id] ?? 0) - (leCorrespondeMap[f.id] ?? 0),
      porCategoria: CATEGORIAS.map((cat) => ({
        key: cat.key,
        label: cat.label,
        leCorresponde: leCorrespondePorCategoria(
          f.id,
          cat.key,
          cat.usaMomentos,
        ),
        total: gastos
          .filter((g) => g.categoria === cat.key)
          .reduce((s, g) => s + g.monto, 0),
      })).filter((c) => c.total > 0),
    }));
  };

  const calcularLiquidaciones = () => {
    const balances = calcularBalancesPorCategoria();
    const deudores = balances
      .filter((b) => b.balance < -1)
      .map((b) => ({ id: b.id, nombre: b.nombre, debe: -b.balance }))
      .sort((a, b) => b.debe - a.debe);
    const acreedores = balances
      .filter((b) => b.balance > 1)
      .map((b) => ({ id: b.id, nombre: b.nombre, leDeben: b.balance }))
      .sort((a, b) => b.leDeben - a.leDeben);
    const transferencias: {
      de: string;
      para: string;
      deFamId: string;
      paraFamId: string;
      monto: number;
    }[] = [];
    const dCopy = deudores.map((d) => ({ ...d }));
    const aCopy = acreedores.map((a) => ({ ...a }));
    let i = 0,
      j = 0;
    while (i < dCopy.length && j < aCopy.length) {
      const monto = Math.min(dCopy[i].debe, aCopy[j].leDeben);
      if (monto > 1)
        transferencias.push({
          de: dCopy[i].nombre,
          para: aCopy[j].nombre,
          deFamId: dCopy[i].id,
          paraFamId: aCopy[j].id,
          monto,
        });
      dCopy[i].debe -= monto;
      aCopy[j].leDeben -= monto;
      if (dCopy[i].debe < 1) i++;
      if (aCopy[j].leDeben < 1) j++;
    }
    return transferencias;
  };

  // ─────────────────────────────────────────────
  // Balance por persona
  // ─────────────────────────────────────────────
  const calcularBalancesPorPersona = () => {
    return participaciones.map((p) => {
      const famId = p.familia_id ?? "__sin_familia__";

      // Calculate each person's share directly per gasto — respecting their individual participation
      const acumuladoPorCat: Record<string, number> = {};

      CATEGORIAS.forEach((cat) => {
        const gastosCat = gastos.filter((g) => g.categoria === cat.key);
        if (gastosCat.length === 0) return;

        if (cat.usaMomentos && momentos.length > 0) {
          // COMIDA: per-moment, check if this person is active
          const totalCat = gastosCat.reduce((s, g) => s + g.monto, 0);
          const costoPorMomento = totalCat / momentos.length;
          let total = 0;
          momentos.forEach((m) => {
            const registros = participantesComidaMap[m.id] ?? {};
            const personaActiva =
              registros[p.id] !== undefined ? registros[p.id] : true;
            if (!personaActiva) return;
            // Active factor for this person in this moment
            const factorPersona = p.factor ?? 1;
            // Total active factor across all participants for this moment
            const factorActivoTotal = participaciones.reduce((s, q) => {
              const activo =
                (participantesComidaMap[m.id] ?? {})[q.id] !== undefined
                  ? (participantesComidaMap[m.id] ?? {})[q.id]
                  : true;
              return s + (activo ? (q.factor ?? 1) : 0);
            }, 0);
            if (factorActivoTotal > 0)
              total += costoPorMomento * (factorPersona / factorActivoTotal);
          });
          acumuladoPorCat[cat.key] = total;
        } else {
          // NON-COMIDA: per gasto, check if this person is active in that specific gasto
          let total = 0;
          gastosCat.forEach((g) => {
            const registros = gastosPartMap[g.id] ?? {};
            const allActive = Object.keys(registros).length === 0;
            const personaActiva = allActive
              ? true
              : registros[p.id] !== undefined
                ? registros[p.id]
                : true;
            if (!personaActiva) return;
            const factorPersona = p.factor ?? 1;
            const factorActivoTotal = participaciones.reduce((s, q) => {
              const activo = allActive
                ? true
                : registros[q.id] !== undefined
                  ? registros[q.id]
                  : true;
              return s + (activo ? (q.factor ?? 1) : 0);
            }, 0);
            if (factorActivoTotal > 0)
              total += g.monto * (factorPersona / factorActivoTotal);
          });
          acumuladoPorCat[cat.key] = total;
        }
      });

      const leCorrespondePorCat = CATEGORIAS.map((cat) => ({
        key: cat.key,
        label: cat.label,
        leCorresponde: acumuladoPorCat[cat.key] ?? 0,
        total: gastos
          .filter((g) => g.categoria === cat.key)
          .reduce((s, g) => s + g.monto, 0),
      })).filter((c) => c.total > 0 && c.leCorresponde > 0);

      const leCorrespondeTotal = Object.values(acumuladoPorCat).reduce(
        (s, v) => s + v,
        0,
      );

      const puso = gastos
        .filter((g) => g.pagado_por === p.persona_id)
        .reduce((s, g) => s + g.monto, 0);

      return {
        id: p.id,
        persona_id: p.persona_id,
        nombre: p.personas.nombre,
        foto_url: p.personas.foto_url,
        familia_id: famId,
        factor: p.factor ?? 1,
        puso,
        leCorresponde: leCorrespondeTotal,
        balance: puso - leCorrespondeTotal,
        porCategoria: leCorrespondePorCat,
      };
    });
  };

  // ─────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────

  const generarTextoResumen = () => {
    const bxf = calcularBalancesPorCategoria();
    const bxp = calcularBalancesPorPersona();
    const liq = calcularLiquidaciones();
    const lines: string[] = [];

    lines.push(`PASEO: ${paseo?.nombre ?? ""}`);
    lines.push(
      `${paseo?.lugar ?? ""} · ${paseo?.fecha_inicio} → ${paseo?.fecha_fin}`,
    );
    lines.push(`Total gastos: ${formatCOP(totalGastado)}`);
    lines.push("");

    // Balance por familia
    lines.push("═══ BALANCE POR FAMILIA ═══");
    bxf.forEach((b) => {
      const signo = b.balance >= 0 ? "+" : "";
      lines.push(`${b.nombre} (factor ${b.factorTotal.toFixed(1)})`);
      lines.push(
        `  Puso: ${formatCOP(b.puso)}  |  Le corresponde: ${formatCOP(b.leCorresponde)}  |  Balance: ${signo}${formatCOP(b.balance)}`,
      );
      b.porCategoria.forEach((cat) => {
        lines.push(`    ${cat.label}: ${formatCOP(cat.leCorresponde)}`);
      });
    });
    lines.push("");

    // Resumen por persona
    lines.push("═══ RESUMEN POR PERSONA ═══");
    familiasList.forEach((fam) => {
      const miembros = bxp.filter((p) => p.familia_id === fam.id);
      if (miembros.length === 0) return;
      lines.push(`▸ ${fam.nombre}`);
      miembros.forEach((p) => {
        const signo = p.balance >= 0 ? "+" : "";
        lines.push(`  ${p.nombre} (factor ${p.factor})`);
        lines.push(
          `    Puso: ${formatCOP(p.puso)}  |  Le corresponde: ${formatCOP(p.leCorresponde)}  |  Balance: ${signo}${formatCOP(p.balance)}`,
        );
        p.porCategoria.forEach((cat) => {
          lines.push(`      ${cat.label}: ${formatCOP(cat.leCorresponde)}`);
        });
      });
    });
    lines.push("");

    // Liquidaciones
    lines.push("═══ LIQUIDACIONES ═══");
    if (liq.length === 0) {
      lines.push("¡Todo cuadrado! No hay deudas pendientes.");
    } else {
      liq.forEach((t) => {
        lines.push(`${t.de} → ${t.para}: ${formatCOP(t.monto)}`);
      });
    }

    return lines.join("\n");
  };

  const generarHTML = () => {
    const bxf = calcularBalancesPorCategoria();
    const bxp = calcularBalancesPorPersona();
    const liq = calcularLiquidaciones();

    const familiasHTML = bxf
      .map((b) => {
        const isPos = b.balance >= 0;
        const color = isPos ? "#16a34a" : "#DC2626";
        const catRows = b.porCategoria
          .map(
            (cat) =>
              `<tr><td style="padding:4px 8px;color:#64748b;font-size:12px">${cat.label}</td><td style="padding:4px 8px;text-align:right;font-size:12px">${formatCOP(cat.leCorresponde)}</td></tr>`,
          )
          .join("");
        return `
        <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <div style="font-weight:700;font-size:15px;color:#1e293b">${b.nombre}</div>
              <div style="font-size:11px;color:#94a3b8">Factor ${b.factorTotal.toFixed(1)}</div>
            </div>
            <div style="font-weight:800;font-size:16px;color:${color}">${isPos ? "+" : ""}${formatCOP(b.balance)}</div>
          </div>
          <div style="display:flex;gap:12px;margin-bottom:8px;background:#f8fafc;border-radius:8px;padding:10px">
            <div style="flex:1;text-align:center"><div style="font-size:10px;color:#94a3b8;font-weight:600">PUSO</div><div style="font-weight:700;font-size:13px">${formatCOP(b.puso)}</div></div>
            <div style="width:1px;background:#e2e8f0"></div>
            <div style="flex:1;text-align:center"><div style="font-size:10px;color:#94a3b8;font-weight:600">LE CORRESPONDE</div><div style="font-weight:700;font-size:13px">${formatCOP(b.leCorresponde)}</div></div>
          </div>
          ${catRows ? `<table style="width:100%;border-collapse:collapse">${catRows}</table>` : ""}
        </div>`;
      })
      .join("");

    const personasHTML = familiasList
      .map((fam, fidx) => {
        const color = UF_COLORS[fidx % UF_COLORS.length];
        const miembros = bxp.filter((p) => p.familia_id === fam.id);
        if (miembros.length === 0) return "";
        const miembrosHTML = miembros
          .map((p) => {
            const isPos = p.balance >= 0;
            const pColor = isPos ? "#16a34a" : "#DC2626";
            const catRows = p.porCategoria
              .map(
                (cat) =>
                  `<tr><td style="padding:3px 8px;color:#64748b;font-size:11px">${cat.label}</td><td style="padding:3px 8px;text-align:right;font-size:11px">${formatCOP(cat.leCorresponde)}</td></tr>`,
              )
              .join("");
            return `
          <div style="background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #f1f5f9">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div>
                <div style="font-weight:700;font-size:14px;color:#1e293b">${p.nombre}</div>
                <div style="font-size:11px;color:#94a3b8">Factor ${p.factor}</div>
              </div>
              <div style="font-weight:800;font-size:14px;color:${pColor}">${isPos ? "+" : ""}${formatCOP(p.balance)}</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:6px;background:#f8fafc;border-radius:6px;padding:8px;font-size:12px">
              <div style="flex:1;text-align:center"><div style="font-size:9px;color:#94a3b8;font-weight:600">PUSO</div><div style="font-weight:700">${formatCOP(p.puso)}</div></div>
              <div style="width:1px;background:#e2e8f0"></div>
              <div style="flex:1;text-align:center"><div style="font-size:9px;color:#94a3b8;font-weight:600">LE CORRESPONDE</div><div style="font-weight:700">${formatCOP(p.leCorresponde)}</div></div>
            </div>
            ${catRows ? `<table style="width:100%;border-collapse:collapse">${catRows}</table>` : ""}
          </div>`;
          })
          .join("");
        return `
        <div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">${fam.nombre}</div>
          ${miembrosHTML}
        </div>`;
      })
      .join("");

    const liquidacionesHTML =
      liq.length === 0
        ? `<div style="text-align:center;padding:24px;color:#16a34a;font-weight:700">✅ ¡Todo cuadrado! No hay deudas pendientes.</div>`
        : liq
            .map(
              (t) => `
          <div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-weight:700;color:#DC2626">${t.de}</span>
              <span style="color:#94a3b8;font-size:18px">→</span>
              <span style="font-weight:700;color:#16a34a">${t.para}</span>
            </div>
            <span style="font-weight:800;font-size:16px;color:#1B4F72">${formatCOP(t.monto)}</span>
          </div>`,
            )
            .join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}
      h2{font-size:22px;font-weight:800;margin:0 0 4px}
      h3{font-size:16px;font-weight:700;margin:24px 0 12px;color:#1B4F72;border-bottom:2px solid #1B4F72;padding-bottom:6px}
      .sub{font-size:13px;color:#64748b;margin-bottom:4px}.total{font-size:14px;font-weight:700;color:#1B4F72;margin-bottom:20px}</style>
      </head><body>
      <h2>${paseo?.nombre ?? "Paseo"}</h2>
      <div class="sub">${paseo?.lugar ?? ""} · ${paseo?.fecha_inicio} → ${paseo?.fecha_fin}</div>
      <div class="total">Total gastos: ${formatCOP(totalGastado)}</div>
      <h3>Balance por familia</h3>${familiasHTML}
      <h3>Resumen por persona</h3>${personasHTML}
      <h3>Liquidaciones</h3>${liquidacionesHTML}
      </body></html>`;
  };

  const loadLiquidacionesPagadas = async () => {
    const { data } = await supabase
      .from("liquidaciones_pagadas")
      .select("*")
      .eq("paseo_id", id);
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((r: any) => {
      map[`${r.de_familia_id}_${r.para_familia_id}`] = r.pagado;
    });
    setLiquidacionesPagadas(map);
  };

  const toggleLiquidacionPagada = async (liq: {
    deFamId: string;
    paraFamId: string;
    monto: number;
  }) => {
    const key = `${liq.deFamId}_${liq.paraFamId}`;
    const currentVal = liquidacionesPagadas[key] ?? false;
    const newVal = !currentVal;
    setSavingLiquidacion(true);
    setLiquidacionesPagadas((prev) => ({ ...prev, [key]: newVal }));
    await supabase.from("liquidaciones_pagadas").upsert(
      {
        paseo_id: id,
        de_familia_id: liq.deFamId,
        para_familia_id: liq.paraFamId,
        monto: liq.monto,
        pagado: newVal,
      },
      { onConflict: "paseo_id,de_familia_id,para_familia_id" },
    );
    setSavingLiquidacion(false);
  };

  const handleMarcarLiquidado = async () => {
    const { error } = await supabase
      .from("paseos")
      .update({ estado: "liquidado" })
      .eq("id", id);
    if (error) showError(error.message);
    else loadTripData();
  };

  const compartirTexto = async () => {
    const texto = generarTextoResumen();
    const { Share } = await import("react-native");
    await Share.share({
      message: texto,
      title: `Liquidación — ${paseo?.nombre}`,
    });
  };

  const compartirPDF = async () => {
    setExportando(true);
    try {
      const html = generarHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Liquidación — ${paseo?.nombre}`,
      });
    } catch (e) {
      showError("No se pudo generar el PDF.");
    }
    setExportando(false);
  };

  // ─────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────
  const momentosDelDia = momentos
    .filter((m) => m.fecha === fechaActiva)
    .sort(
      (a, b) =>
        TIPOS_COMIDA.indexOf(a.tipo_comida) -
        TIPOS_COMIDA.indexOf(b.tipo_comida),
    );

  const personasEnPaseo = new Set(participaciones.map((p) => p.persona_id));
  const personasFiltradas = personas
    .filter(
      (p) =>
        !personasEnPaseo.has(p.id) &&
        p.nombre.toLowerCase().includes(personaSearch.toLowerCase()),
    )
    .slice(0, 8);

  const estadoConfig =
    ESTADO_CONFIG[paseo?.estado] ?? ESTADO_CONFIG["planificacion"];
  const balancesPorFamilia = calcularBalancesPorCategoria();
  const liquidaciones = calcularLiquidaciones();
  const balancesPorPersona = calcularBalancesPorPersona();
  const totalGastado = gastos.reduce((sum, g) => sum + g.monto, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1B4F72" />
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {paseo?.nombre}
            </Text>
            <TouchableOpacity
              style={[styles.estadoBadge, { backgroundColor: estadoConfig.bg }]}
              onPress={() => isOrganizer && setShowEstadoModal(true)}
            >
              <Text style={[styles.estadoText, { color: estadoConfig.color }]}>
                {estadoConfig.label}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TABS */}
        <View style={styles.tabs}>
          {(["info", "participantes", "menu", "gastos"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === "info"
                  ? "📋 Info"
                  : tab === "participantes"
                    ? "👥 Asistentes"
                    : tab === "menu"
                      ? "🍽️ Menú"
                      : "💸 Gastos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════
            INFO TAB
        ══════════════════════════════════════ */}
        {activeTab === "info" && (
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity
              style={styles.tripPhotoContainer}
              onPress={() => setShowPhotoModal(true)}
            >
              {uploadingPhoto ? (
                <View style={styles.tripPhotoPlaceholder}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : editFotoUrl ? (
                <Image source={{ uri: editFotoUrl }} style={styles.tripPhoto} />
              ) : (
                <View style={styles.tripPhotoPlaceholder}>
                  <Text style={styles.tripPhotoIcon}>📸</Text>
                  <Text style={styles.tripPhotoText}>
                    Toca para agregar foto del paseo
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>📋 Información</Text>
                {editing ? (
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => setEditing(false)}>
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleSaveInfo}
                      disabled={saving}
                    >
                      <Text style={styles.saveBtnText}>
                        {saving ? "..." : "Guardar"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setEditing(true)}>
                    <Text style={styles.editText}>✏️ Editar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {editing ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Nombre</Text>
                    <TextInput
                      style={styles.input}
                      value={editNombre}
                      onChangeText={setEditNombre}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Lugar</Text>
                    <TextInput
                      style={styles.input}
                      value={editLugar}
                      onChangeText={setEditLugar}
                    />
                  </View>
                  <View style={styles.row}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Fecha inicio</Text>
                      <TextInput
                        style={styles.input}
                        value={editFechaInicio}
                        onChangeText={setEditFechaInicio}
                        placeholder="AAAA-MM-DD"
                      />
                    </View>
                    <View style={{ width: 8 }} />
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.fieldLabel}>Fecha fin</Text>
                      <TextInput
                        style={styles.input}
                        value={editFechaFin}
                        onChangeText={setEditFechaFin}
                        placeholder="AAAA-MM-DD"
                      />
                    </View>
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Link de alojamiento</Text>
                    <TextInput
                      style={styles.input}
                      value={editLink}
                      onChangeText={setEditLink}
                      placeholder="https://airbnb.com/..."
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>
                      Recomendaciones de llegada
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 80 }]}
                      value={editRecomendaciones}
                      onChangeText={setEditRecomendaciones}
                      multiline
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Link de ubicación</Text>
                    <TextInput
                      style={styles.input}
                      value={editLinkMapa}
                      onChangeText={setEditLinkMapa}
                      placeholder="https://maps.google.com/..."
                      autoCapitalize="none"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>📍 Lugar</Text>
                    <Text style={styles.infoValue}>{paseo?.lugar}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>📅 Fechas</Text>
                    <Text style={styles.infoValue}>
                      {paseo?.fecha_inicio} → {paseo?.fecha_fin}
                    </Text>
                  </View>
                  {paseo?.link_alojamiento && (
                    <TouchableOpacity
                      style={styles.infoRow}
                      onPress={() => Linking.openURL(paseo.link_alojamiento)}
                    >
                      <Text style={styles.infoLabel}>🏠 Alojamiento</Text>
                      <Text style={[styles.infoValue, styles.link]}>
                        Ver enlace →
                      </Text>
                    </TouchableOpacity>
                  )}
                  {paseo?.recomendaciones && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>💡 Llegada</Text>
                      <Text style={styles.infoValue}>
                        {paseo.recomendaciones}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
            <View style={styles.inviteCard}>
              <Text style={styles.inviteLabel}>🔑 Código de invitación</Text>
              <Text style={styles.inviteCode}>{paseo?.codigo_invitacion}</Text>
              <Text style={styles.inviteHint}>
                Comparte este código para que otros se unan
              </Text>
            </View>
            {paseo?.link_mapa &&
              (() => {
                const coords = extractCoordsFromLink(paseo.link_mapa);
                return (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>🗺️ Ubicación</Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL(paseo.link_mapa)}
                      >
                        <Text style={styles.editText}>Abrir en Maps →</Text>
                      </TouchableOpacity>
                    </View>
                    {coords ? (
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: coords.lat,
                          longitude: coords.lng,
                          latitudeDelta: 0.005,
                          longitudeDelta: 0.005,
                        }}
                      >
                        <Marker
                          coordinate={{
                            latitude: coords.lat,
                            longitude: coords.lng,
                          }}
                          title={paseo.nombre}
                          description={paseo.lugar}
                        />
                      </MapView>
                    ) : (
                      <TouchableOpacity
                        style={styles.mapLinkCard}
                        onPress={() => Linking.openURL(paseo.link_mapa)}
                      >
                        <Text style={styles.mapLinkIcon}>🗺️</Text>
                        <View style={styles.mapLinkInfo}>
                          <Text style={styles.mapLinkTitle}>Ver ubicación</Text>
                          <Text style={styles.mapLinkSub}>
                            Toca para abrir en Maps
                          </Text>
                        </View>
                        <Text style={styles.mapLinkArrow}>→</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}
            {isOrganizer && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => setShowDeleteTripModal(true)}
              >
                <Text style={styles.deleteButtonText}>🗑️ Eliminar paseo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* ══════════════════════════════════════
            PARTICIPANTES TAB
        ══════════════════════════════════════ */}
        {activeTab === "participantes" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                👥 {participaciones.length} participante
                {participaciones.length !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.addBtnText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>

            {familiasList.length === 0 && participaciones.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>Aún no hay participantes</Text>
                <Text style={styles.emptySub}>
                  Agrega el primero para comenzar
                </Text>
              </View>
            ) : (
              familiasList.map((fam, fidx) => {
                const miembros = participaciones.filter(
                  (p) => p.familia_id === fam.id,
                );
                if (miembros.length === 0) return null;
                const color = UF_COLORS[fidx % UF_COLORS.length];
                return (
                  <View key={fam.id} style={styles.familiaCard}>
                    {/* Familia header */}
                    <TouchableOpacity
                      style={styles.familiaHeader}
                      onPress={() => openEditFamilia(fam)}
                    >
                      {fam.foto_url ? (
                        <Image
                          source={{ uri: fam.foto_url }}
                          style={[styles.familiaAvatar, { borderColor: color }]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.familiaAvatarPlaceholder,
                            { backgroundColor: color },
                          ]}
                        >
                          <Text style={styles.familiaAvatarText}>
                            {fam.nombre.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.familiaTitulo}>{fam.nombre}</Text>
                        <Text style={styles.familiaCount}>
                          {miembros.length} persona
                          {miembros.length !== 1 ? "s" : ""} · toca para editar
                        </Text>
                      </View>
                      <Text style={{ fontSize: 18, color: "#cbd5e1" }}>›</Text>
                    </TouchableOpacity>
                    {/* Members */}
                    {miembros.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.participanteRow}
                        onPress={() => handleParticipanteOptions(m)}
                      >
                        <View>
                          {m.personas.foto_url ? (
                            <Image
                              source={{ uri: m.personas.foto_url }}
                              style={[
                                styles.avatarImage,
                                { borderColor: color },
                              ]}
                            />
                          ) : (
                            <View
                              style={[
                                styles.avatar,
                                { backgroundColor: color },
                              ]}
                            >
                              <Text style={styles.avatarText}>
                                {initials(m.personas.nombre)}
                              </Text>
                            </View>
                          )}
                          {m.personas.auth_user_id && (
                            <View style={styles.accountBadge}>
                              <Text style={{ fontSize: 8, color: "#fff" }}>
                                ✓
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.participanteInfo}>
                          <Text style={styles.participanteNombre}>
                            {m.personas.nombre}
                          </Text>
                          <Text style={styles.participanteSub}>
                            Factor {m.factor ?? 1}
                          </Text>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ══════════════════════════════════════
            MENU TAB
        ══════════════════════════════════════ */}
        {activeTab === "menu" && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dateSelector}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {fechas.map((fecha) => {
                const d = new Date(fecha + "T12:00:00");
                const label = d.toLocaleDateString("es-CO", {
                  weekday: "short",
                  day: "numeric",
                });
                return (
                  <TouchableOpacity
                    key={fecha}
                    style={[
                      styles.dateChip,
                      fechaActiva === fecha && styles.dateChipActive,
                    ]}
                    onPress={() => setFechaActiva(fecha)}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        fechaActiva === fecha && styles.dateChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <ScrollView contentContainerStyle={styles.content}>
              {momentosDelDia.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🍴</Text>
                  <Text style={styles.emptyText}>
                    Sin comidas para este día
                  </Text>
                </View>
              ) : (
                momentosDelDia.map((m) => {
                  const config =
                    TIPO_CONFIG[m.tipo_comida] ?? TIPO_CONFIG["snack"];
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.mealCard,
                        { borderLeftColor: config.color },
                      ]}
                      onPress={() => openMealDetail(m)}
                      onLongPress={() => handleMealOptions(m)}
                    >
                      <View style={styles.mealCardTop}>
                        <View
                          style={[
                            styles.tipoBadge,
                            { backgroundColor: config.bgColor },
                          ]}
                        >
                          <Text>{config.icon}</Text>
                          <Text
                            style={[
                              styles.tipoBadgeText,
                              { color: config.color },
                            ]}
                          >
                            {m.tipo_comida.charAt(0).toUpperCase() +
                              m.tipo_comida.slice(1)}
                          </Text>
                        </View>
                        <Text style={styles.longPressHint}>
                          toca · mantén para opciones
                        </Text>
                      </View>
                      <Text style={styles.mealNombre}>
                        {m.recetas?.nombre ?? "Sin receta"}
                      </Text>
                      <Text style={styles.mealPorciones}>
                        👥 {m.porciones ?? participaciones.length} porciones
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
              <TouchableOpacity
                style={styles.addMealButton}
                onPress={() => setShowAddMealModal(true)}
              >
                <Text style={styles.addMealButtonText}>+ Agregar comida</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* ══════════════════════════════════════
            GASTOS TAB
        ══════════════════════════════════════ */}
        {activeTab === "gastos" && (
          <>
            <View style={styles.gastosSubTabs}>
              {(["gastos", "balances", "liquidar"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.gastosSubTab,
                    gastosTab === t && styles.gastosSubTabActive,
                  ]}
                  onPress={() => setGastosTab(t)}
                >
                  <Text
                    style={[
                      styles.gastosSubTabText,
                      gastosTab === t && styles.gastosSubTabTextActive,
                    ]}
                  >
                    {t === "gastos"
                      ? "💰 Gastos"
                      : t === "balances"
                        ? "⚖️ Balances"
                        : "💸 Liquidar"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {gastosTab === "gastos" && (
              <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Gastos del paseo</Text>
                    <Text style={styles.gastosTotalLabel}>
                      Total: {formatCOP(totalGastado)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setShowAddGastoModal(true)}
                  >
                    <Text style={styles.addBtnText}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
                {gastos.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🧾</Text>
                    <Text style={styles.emptyText}>Sin gastos registrados</Text>
                    <Text style={styles.emptySub}>
                      Agrega el primer gasto del paseo
                    </Text>
                  </View>
                ) : (
                  gastos.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.gastoCard}
                      onLongPress={() => {
                        setGastoOptionsTarget(g);
                        setShowGastoOptionsModal(true);
                      }}
                    >
                      <View style={styles.gastoCardLeft}>
                        <Text style={styles.gastoNombre}>{g.nombre}</Text>
                        <Text style={styles.gastoPagadoPorText}>
                          Pagó: {g.personas?.nombre ?? "—"}
                        </Text>
                        <Text style={styles.gastoCategoriaLabel}>
                          {CATEGORIAS.find(
                            (c) => c.key === (g.categoria ?? "otros"),
                          )?.label ?? "📦 Otros"}
                        </Text>
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
                  ))
                )}
              </ScrollView>
            )}

            {gastosTab === "balances" && (
              <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>
                  Balance por familia
                </Text>
                <Text style={[styles.gastosSubHint, { marginBottom: 16 }]}>
                  Total: {formatCOP(totalGastado)} · {momentos.length} comida
                  {momentos.length !== 1 ? "s" : ""}
                </Text>
                {balancesPorFamilia.map((b) => {
                  const isPos = b.balance >= 0;
                  return (
                    <View key={b.id} style={styles.balanceCard}>
                      <View style={styles.balanceCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.balanceNombre}>{b.nombre}</Text>
                          <Text style={styles.balanceMiembros}>
                            Factor {b.factorTotal.toFixed(1)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.balanceSaldo,
                            { color: isPos ? "#16a34a" : "#DC2626" },
                          ]}
                        >
                          {isPos ? "+" : ""}
                          {formatCOP(b.balance)}
                        </Text>
                      </View>
                      <View style={styles.balanceRow}>
                        <View style={styles.balanceItem}>
                          <Text style={styles.balanceItemLabel}>Puso</Text>
                          <Text style={styles.balanceItemValue}>
                            {formatCOP(b.puso)}
                          </Text>
                        </View>
                        <View style={styles.balanceDivider} />
                        <View style={styles.balanceItem}>
                          <Text style={styles.balanceItemLabel}>
                            Le corresponde
                          </Text>
                          <Text style={styles.balanceItemValue}>
                            {formatCOP(b.leCorresponde)}
                          </Text>
                        </View>
                      </View>
                      {b.porCategoria.map((cat) => (
                        <View key={cat.key} style={styles.balanceCatRow}>
                          <Text style={styles.balanceCatLabel}>
                            {cat.label}
                          </Text>
                          <Text style={styles.balanceCatValue}>
                            {formatCOP(cat.leCorresponde)}
                          </Text>
                        </View>
                      ))}
                      <View style={styles.balanceBarBg}>
                        <View
                          style={[
                            styles.balanceBarFill,
                            {
                              width: `${Math.min(100, (b.puso / (totalGastado || 1)) * 100)}%`,
                              backgroundColor: isPos ? "#16a34a" : "#DC2626",
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}

                {/* ── Resumen por persona ── */}
                {participaciones.length > 0 && (
                  <>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { marginTop: 24, marginBottom: 4 },
                      ]}
                    >
                      Resumen por persona
                    </Text>
                    <Text style={[styles.gastosSubHint, { marginBottom: 16 }]}>
                      Cuánto le corresponde a cada uno individualmente
                    </Text>
                    {familiasList.map((fam, fidx) => {
                      const miembros = balancesPorPersona.filter(
                        (p) => p.familia_id === fam.id,
                      );
                      if (miembros.length === 0) return null;
                      const color = UF_COLORS[fidx % UF_COLORS.length];
                      return (
                        <View
                          key={fam.id}
                          style={[
                            styles.personaBalanceGroup,
                            { borderLeftColor: color },
                          ]}
                        >
                          <Text
                            style={[
                              styles.personaBalanceGroupNombre,
                              { color },
                            ]}
                          >
                            {fam.nombre}
                          </Text>
                          {miembros.map((p) => {
                            const isPos = p.balance >= 0;
                            return (
                              <View
                                key={p.id}
                                style={styles.personaBalanceCard}
                              >
                                <View style={styles.personaBalanceTop}>
                                  {p.foto_url ? (
                                    <Image
                                      source={{ uri: p.foto_url }}
                                      style={[
                                        styles.personaBalanceAvatar,
                                        { borderColor: color },
                                      ]}
                                    />
                                  ) : (
                                    <View
                                      style={[
                                        styles.avatar,
                                        {
                                          backgroundColor: color,
                                          width: 36,
                                          height: 36,
                                          borderRadius: 18,
                                        },
                                      ]}
                                    >
                                      <Text style={styles.avatarText}>
                                        {initials(p.nombre)}
                                      </Text>
                                    </View>
                                  )}
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.personaBalanceNombre}>
                                      {p.nombre}
                                    </Text>
                                    <Text style={styles.personaBalanceFactor}>
                                      Factor {p.factor}
                                    </Text>
                                  </View>
                                  <Text
                                    style={[
                                      styles.balanceSaldo,
                                      {
                                        color: isPos ? "#16a34a" : "#DC2626",
                                        fontSize: 14,
                                      },
                                    ]}
                                  >
                                    {isPos ? "+" : ""}
                                    {formatCOP(p.balance)}
                                  </Text>
                                </View>
                                <View style={styles.balanceRow}>
                                  <View style={styles.balanceItem}>
                                    <Text style={styles.balanceItemLabel}>
                                      Puso
                                    </Text>
                                    <Text style={styles.balanceItemValue}>
                                      {formatCOP(p.puso)}
                                    </Text>
                                  </View>
                                  <View style={styles.balanceDivider} />
                                  <View style={styles.balanceItem}>
                                    <Text style={styles.balanceItemLabel}>
                                      Le corresponde
                                    </Text>
                                    <Text style={styles.balanceItemValue}>
                                      {formatCOP(p.leCorresponde)}
                                    </Text>
                                  </View>
                                </View>
                                {p.porCategoria.map((cat) => (
                                  <View
                                    key={cat.key}
                                    style={styles.balanceCatRow}
                                  >
                                    <Text style={styles.balanceCatLabel}>
                                      {cat.label}
                                    </Text>
                                    <Text style={styles.balanceCatValue}>
                                      {formatCOP(cat.leCorresponde)}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </>
                )}
              </ScrollView>
            )}

            {gastosTab === "liquidar" && (
              <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionTitle, { marginBottom: 2 }]}>
                      Liquidaciones
                    </Text>
                    <Text style={styles.gastosSubHint}>
                      Transferencias mínimas para cuadrar cuentas
                    </Text>
                  </View>
                </View>

                {/* Export buttons */}
                {gastos.length > 0 && (
                  <View style={styles.exportRow}>
                    <TouchableOpacity
                      style={styles.exportBtn}
                      onPress={compartirTexto}
                    >
                      <Text style={styles.exportBtnText}>
                        💬 WhatsApp / Copiar
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.exportBtn, styles.exportBtnPDF]}
                      onPress={compartirPDF}
                      disabled={exportando}
                    >
                      {exportando ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[styles.exportBtnText, { color: "#fff" }]}>
                          📄 Exportar PDF
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {liquidaciones.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>
                      {gastos.length === 0 ? "🧾" : "✅"}
                    </Text>
                    <Text style={styles.emptyText}>
                      {gastos.length === 0
                        ? "Sin gastos aún"
                        : "¡Todo cuadrado!"}
                    </Text>
                    <Text style={styles.emptySub}>
                      {gastos.length === 0
                        ? "Registra gastos para ver las liquidaciones"
                        : "No hay deudas pendientes"}
                    </Text>
                  </View>
                ) : (
                  <>
                    {liquidaciones.map((t, i) => {
                      const key = `${t.deFamId}_${t.paraFamId}`;
                      const pagada = liquidacionesPagadas[key] ?? false;
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[
                            styles.liquidacionCard,
                            pagada && styles.liquidacionCardPagada,
                          ]}
                          onPress={() => toggleLiquidacionPagada(t)}
                          disabled={savingLiquidacion}
                        >
                          <View
                            style={[
                              styles.liqCheckbox,
                              pagada && styles.liqCheckboxPagada,
                            ]}
                          >
                            {pagada && (
                              <Text style={styles.liqCheckmark}>✓</Text>
                            )}
                          </View>
                          <View style={styles.liquidacionLeft}>
                            <Text
                              style={[
                                styles.liquidacionDe,
                                pagada && styles.liquidacionTextPagada,
                              ]}
                            >
                              {t.de}
                            </Text>
                            <Text
                              style={[
                                styles.liquidacionArrow,
                                pagada && styles.liquidacionTextPagada,
                              ]}
                            >
                              →
                            </Text>
                            <Text
                              style={[
                                styles.liquidacionPara,
                                pagada && styles.liquidacionTextPagada,
                              ]}
                            >
                              {t.para}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.liquidacionMonto,
                              pagada && styles.liquidacionTextPagada,
                            ]}
                          >
                            {formatCOP(t.monto)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {/* Marcar paseo como liquidado cuando todo está pagado */}
                    {liquidaciones.every(
                      (t) =>
                        liquidacionesPagadas[`${t.deFamId}_${t.paraFamId}`],
                    ) &&
                      paseo?.estado !== "liquidado" && (
                        <View style={styles.liquidadoPrompt}>
                          <Text style={styles.liquidadoPromptText}>
                            ✅ Todos los pagos están realizados
                          </Text>
                          <TouchableOpacity
                            style={styles.liquidadoBtn}
                            onPress={handleMarcarLiquidado}
                          >
                            <Text style={styles.liquidadoBtnText}>
                              Marcar paseo como Liquidado
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                    {paseo?.estado === "liquidado" && (
                      <View
                        style={[
                          styles.liquidadoPrompt,
                          { backgroundColor: "#DBEAFE" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.liquidadoPromptText,
                            { color: "#1D4ED8" },
                          ]}
                        >
                          💸 Este paseo está liquidado
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            )}
          </>
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
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>⚠️ Error</Text>
              <Text style={styles.confirmMessage}>{errorMessage}</Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#1B4F72" }]}
                onPress={() => setShowErrorModal(false)}
              >
                <Text style={styles.confirmBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Photo source */}
        <Modal
          visible={showPhotoModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowPhotoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>Foto del paseo</Text>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => pickTripPhoto("camera")}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  📷 Tomar foto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => pickTripPhoto("gallery")}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  🖼️ Elegir de galería
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowPhotoModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Delete trip */}
        <Modal
          visible={showDeleteTripModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDeleteTripModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>🗑️ Eliminar paseo</Text>
              <Text style={styles.confirmMessage}>
                ¿Eliminar "{paseo?.nombre}"? Esta acción no se puede deshacer.
              </Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
                onPress={handleDeleteTrip}
              >
                <Text style={styles.confirmBtnText}>Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowDeleteTripModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Estado */}
        <Modal
          visible={showEstadoModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowEstadoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>
                Cambiar estado del paseo
              </Text>
              {ESTADOS.map((estado) => {
                const config = ESTADO_CONFIG[estado];
                return (
                  <TouchableOpacity
                    key={estado}
                    style={[
                      styles.estadoOption,
                      { backgroundColor: config.bg },
                    ]}
                    onPress={() => handleChangeEstado(estado)}
                  >
                    <Text
                      style={[styles.estadoOptionText, { color: config.color }]}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowEstadoModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit familia modal */}
        <Modal
          visible={showEditFamiliaModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowEditFamiliaModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditFamiliaModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar familia</Text>
              <TouchableOpacity onPress={saveEditFamilia}>
                <Text style={styles.modalSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Familia photo */}
              <TouchableOpacity
                style={styles.familiaPhotoBtn}
                onPress={pickFamiliaPhoto}
              >
                {uploadingFamiliaPhoto ? (
                  <View style={styles.familiaPhotoBtnPlaceholder}>
                    <ActivityIndicator color="#1B4F72" />
                  </View>
                ) : editingFamilia?.foto_url ? (
                  <Image
                    source={{ uri: editingFamilia.foto_url }}
                    style={styles.familiaPhotoBtnImg}
                  />
                ) : (
                  <View style={styles.familiaPhotoBtnPlaceholder}>
                    <Text style={{ fontSize: 32 }}>📸</Text>
                    <Text style={styles.familiaPhotoBtnText}>
                      Foto de familia
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nombre de la familia</Text>
                <TextInput
                  style={styles.input}
                  value={editFamiliaNombre}
                  onChangeText={setEditFamiliaNombre}
                  placeholder="Ej: Familia García, Los Rodríguez..."
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Participant options */}
        <Modal
          visible={showOptionsModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>
                {optionsParticipante?.personas?.nombre}
              </Text>
              <Text
                style={[
                  styles.familiaModalSub,
                  { textAlign: "center", marginBottom: 12 },
                ]}
              >
                {familiasList.find(
                  (f) => f.id === optionsParticipante?.familia_id,
                )?.nombre ?? ""}{" "}
                · Factor {optionsParticipante?.factor ?? 1}
              </Text>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => {
                  setShowOptionsModal(false);
                  router.push({
                    pathname: "/participantDetail",
                    params: { personaId: optionsParticipante?.persona_id },
                  });
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  Ver perfil
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => {
                  setShowOptionsModal(false);
                  if (optionsParticipante)
                    handleChangeFactor(optionsParticipante);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  Cambiar factor
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => {
                  setShowOptionsModal(false);
                  if (optionsParticipante)
                    handleMoveToFamilia(optionsParticipante);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  Mover a otra familia
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#FEE2E2" }]}
                onPress={() => {
                  setShowOptionsModal(false);
                  if (optionsParticipante)
                    handleDeleteParticipante(optionsParticipante);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#DC2626" }]}>
                  Eliminar del paseo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowOptionsModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Factor modal */}
        <Modal
          visible={showFactorModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowFactorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.familiaModalBox}>
              <Text style={styles.familiaModalTitle}>
                Factor de participación
              </Text>
              <Text style={styles.familiaModalSub}>
                {factorParticipante?.personas?.nombre}
              </Text>
              <Text
                style={[
                  styles.fieldHint,
                  { textAlign: "center", marginBottom: 12 },
                ]}
              >
                Valor entre 0 y 1 · adulto=1.0, niño=0.5
              </Text>
              <TextInput
                style={styles.familiaInput}
                value={factorEditInput}
                onChangeText={setFactorEditInput}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.familiaModalButtons}>
                <TouchableOpacity
                  style={styles.familiaModalCancel}
                  onPress={() => setShowFactorModal(false)}
                >
                  <Text style={styles.familiaModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.familiaModalSave}
                  onPress={applyFactor}
                >
                  <Text style={styles.familiaModalSaveText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Move to familia modal */}
        <Modal
          visible={showMoveFamiliaModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMoveFamiliaModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>Mover a familia</Text>
              {familiasList.map((fam, fidx) => (
                <TouchableOpacity
                  key={fam.id}
                  style={[
                    styles.estadoOption,
                    {
                      backgroundColor:
                        UF_COLORS[fidx % UF_COLORS.length] + "22",
                    },
                  ]}
                  onPress={() => applyMoveFamilia(fam.id)}
                >
                  <Text
                    style={[
                      styles.estadoOptionText,
                      { color: UF_COLORS[fidx % UF_COLORS.length] },
                    ]}
                  >
                    {fam.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowMoveFamiliaModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Delete participant */}
        <Modal
          visible={showDeletePartModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDeletePartModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Eliminar participante</Text>
              <Text style={styles.confirmMessage}>
                ¿Eliminar a {deletePartTarget?.personas?.nombre} del paseo?
              </Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
                onPress={confirmDeleteParticipante}
              >
                <Text style={styles.confirmBtnText}>Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowDeletePartModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add participant modal */}
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
              <Text style={styles.modalTitle}>Agregar participante</Text>
              <TouchableOpacity
                onPress={handleAddParticipant}
                disabled={savingParticipant}
              >
                <Text style={styles.modalSave}>
                  {savingParticipant ? "..." : "Agregar"}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Persona ── */}
              <Text style={styles.modalSectionLabel}>👤 Persona</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !addingNew && styles.toggleBtnActive,
                  ]}
                  onPress={() => setAddingNew(false)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !addingNew && styles.toggleTextActive,
                    ]}
                  >
                    Buscar existente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    addingNew && styles.toggleBtnActive,
                  ]}
                  onPress={() => setAddingNew(true)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      addingNew && styles.toggleTextActive,
                    ]}
                  >
                    Nueva persona
                  </Text>
                </TouchableOpacity>
              </View>

              {addingNew ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nombre *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Francisco"
                    placeholderTextColor="#94a3b8"
                    value={newPersonaNombre}
                    onChangeText={setNewPersonaNombre}
                  />
                </View>
              ) : (
                <View style={styles.field}>
                  <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar persona..."
                      placeholderTextColor="#94a3b8"
                      value={personaSearch}
                      onChangeText={(t) => {
                        setPersonaSearch(t);
                        setSelectedPersonaId(null);
                      }}
                    />
                    {personaSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setPersonaSearch("");
                          setSelectedPersonaId(null);
                        }}
                      >
                        <Text
                          style={{
                            color: "#94a3b8",
                            fontSize: 16,
                            paddingHorizontal: 8,
                          }}
                        >
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {personaSearch.length >= 1 && (
                    <View style={styles.searchResults}>
                      {personasFiltradas.length === 0 ? (
                        <Text style={styles.noPersonas}>
                          Sin resultados. Usa "Nueva persona".
                        </Text>
                      ) : (
                        personasFiltradas.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={[
                              styles.searchResultItem,
                              selectedPersonaId === p.id &&
                                styles.searchResultItemActive,
                            ]}
                            onPress={() => setSelectedPersonaId(p.id)}
                          >
                            <View
                              style={[
                                styles.searchResultDot,
                                {
                                  backgroundColor:
                                    selectedPersonaId === p.id
                                      ? "#1B4F72"
                                      : "#e2e8f0",
                                },
                              ]}
                            />
                            <Text
                              style={[
                                styles.searchResultText,
                                selectedPersonaId === p.id &&
                                  styles.searchResultTextActive,
                              ]}
                            >
                              {p.nombre}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                  {selectedPersonaId && (
                    <View style={styles.selectedPersonaBadge}>
                      <Text style={styles.selectedPersonaText}>
                        ✓{" "}
                        {
                          personas.find((p) => p.id === selectedPersonaId)
                            ?.nombre
                        }
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── Familia ── */}
              <Text style={[styles.modalSectionLabel, { marginTop: 8 }]}>
                🏠 Familia
              </Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    !creatingNewFamilia && styles.toggleBtnActive,
                  ]}
                  onPress={() => setCreatingNewFamilia(false)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !creatingNewFamilia && styles.toggleTextActive,
                    ]}
                  >
                    Existente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    creatingNewFamilia && styles.toggleBtnActive,
                  ]}
                  onPress={() => setCreatingNewFamilia(true)}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      creatingNewFamilia && styles.toggleTextActive,
                    ]}
                  >
                    Nueva familia
                  </Text>
                </TouchableOpacity>
              </View>

              {creatingNewFamilia ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Nombre de la familia *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Familia García"
                    placeholderTextColor="#94a3b8"
                    value={newFamiliaNombre}
                    onChangeText={setNewFamiliaNombre}
                  />
                </View>
              ) : (
                <View style={styles.field}>
                  {familiasList.length === 0 ? (
                    <Text style={styles.noPersonas}>
                      No hay familias. Crea la primera.
                    </Text>
                  ) : (
                    familiasList.map((fam, fidx) => (
                      <TouchableOpacity
                        key={fam.id}
                        style={[
                          styles.personaOption,
                          selectedFamiliaId === fam.id &&
                            styles.personaOptionActive,
                        ]}
                        onPress={() => setSelectedFamiliaId(fam.id)}
                      >
                        <View
                          style={[
                            styles.searchResultDot,
                            {
                              backgroundColor:
                                UF_COLORS[fidx % UF_COLORS.length],
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.personaOptionText,
                            selectedFamiliaId === fam.id &&
                              styles.personaOptionTextActive,
                          ]}
                        >
                          {fam.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {/* ── Factor ── */}
              <Text style={[styles.modalSectionLabel, { marginTop: 8 }]}>
                ⚖️ Factor de participación
              </Text>
              <Text style={[styles.fieldHint, { marginBottom: 8 }]}>
                Valor entre 0 y 1 — adulto completo = 1.0, niño pequeño = 0.3,
                etc.
              </Text>
              <View style={styles.factorSliderRow}>
                {["0.25", "0.5", "0.75", "1.0"].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.factorPresetBtn,
                      factorInput === f && styles.factorPresetBtnActive,
                    ]}
                    onPress={() => setFactorInput(f)}
                  >
                    <Text
                      style={[
                        styles.factorPresetText,
                        factorInput === f && styles.factorPresetTextActive,
                      ]}
                    >
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    textAlign: "center",
                    fontSize: 20,
                    fontWeight: "700",
                    marginTop: 8,
                  },
                ]}
                value={factorInput}
                onChangeText={setFactorInput}
                keyboardType="decimal-pad"
                placeholder="1.0"
                placeholderTextColor="#94a3b8"
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Meal detail / participantes por comida */}
        <Modal
          visible={showMealDetailModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMealDetailModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowMealDetailModal(false)}>
                <Text style={styles.modalCancel}>Cerrar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {mealDetailTarget?.recetas?.nombre ?? "Comida"}
              </Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView style={styles.modalContent}>
              {/* Meal info */}
              {mealDetailTarget &&
                (() => {
                  const config =
                    TIPO_CONFIG[mealDetailTarget.tipo_comida] ??
                    TIPO_CONFIG["snack"];
                  return (
                    <View
                      style={[
                        styles.mealDetailHeader,
                        { backgroundColor: config.bgColor },
                      ]}
                    >
                      <Text style={{ fontSize: 28 }}>{config.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.mealDetailTipo,
                            { color: config.color },
                          ]}
                        >
                          {mealDetailTarget.tipo_comida
                            .charAt(0)
                            .toUpperCase() +
                            mealDetailTarget.tipo_comida.slice(1)}
                        </Text>
                        <Text style={styles.mealDetailFecha}>
                          {mealDetailTarget.fecha}
                        </Text>
                      </View>
                      <View style={styles.mealDetailPorciones}>
                        <Text style={styles.mealDetailPorcionesNum}>
                          {mealDetailTarget.porciones ?? participaciones.length}
                        </Text>
                        <Text style={styles.mealDetailPorcionesSub}>
                          porciones
                        </Text>
                      </View>
                    </View>
                  );
                })()}

              <Text
                style={[
                  styles.modalSectionLabel,
                  { marginTop: 20, marginBottom: 8 },
                ]}
              >
                👥 Participantes en esta comida
              </Text>
              <Text style={[styles.fieldHint, { marginBottom: 12 }]}>
                Desactiva quien no participa — afecta porciones y costos
              </Text>

              {loadingParticipantes ? (
                <ActivityIndicator color="#1B4F72" style={{ marginTop: 20 }} />
              ) : participaciones.length === 0 ? (
                <Text style={styles.noPersonas}>
                  No hay participantes en el paseo.
                </Text>
              ) : (
                familiasList.map((fam, fidx) => {
                  const miembros = participaciones.filter(
                    (p) => p.familia_id === fam.id,
                  );
                  if (miembros.length === 0) return null;
                  const color = UF_COLORS[fidx % UF_COLORS.length];
                  return (
                    <View
                      key={fam.id}
                      style={[
                        styles.mealPartFamilia,
                        { borderLeftColor: color },
                      ]}
                    >
                      <Text style={[styles.mealPartFamiliaNombre, { color }]}>
                        {fam.nombre}
                      </Text>
                      {miembros.map((m) => {
                        const activo = participantesComida[m.id] !== false;
                        return (
                          <View key={m.id} style={styles.mealPartRow}>
                            <View style={styles.mealPartInfo}>
                              {m.personas.foto_url ? (
                                <Image
                                  source={{ uri: m.personas.foto_url }}
                                  style={[
                                    styles.mealPartAvatar,
                                    {
                                      borderColor: color,
                                      opacity: activo ? 1 : 0.35,
                                    },
                                  ]}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.avatar,
                                    {
                                      backgroundColor: activo
                                        ? color
                                        : "#e2e8f0",
                                      width: 32,
                                      height: 32,
                                      borderRadius: 16,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.avatarText,
                                      { fontSize: 11 },
                                    ]}
                                  >
                                    {initials(m.personas.nombre)}
                                  </Text>
                                </View>
                              )}
                              <View>
                                <Text
                                  style={[
                                    styles.mealPartNombre,
                                    { color: activo ? "#1e293b" : "#94a3b8" },
                                  ]}
                                >
                                  {m.personas.nombre}
                                </Text>
                                <Text style={styles.mealPartFactor}>
                                  Factor {m.factor ?? 1}
                                </Text>
                              </View>
                            </View>
                            <Switch
                              value={activo}
                              onValueChange={() =>
                                toggleParticipante(m.id, activo)
                              }
                              trackColor={{
                                false: "#e2e8f0",
                                true: color + "66",
                              }}
                              thumbColor={activo ? color : "#94a3b8"}
                            />
                          </View>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Meal options */}
        <Modal
          visible={showMealOptionsModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowMealOptionsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>
                {mealOptionsTarget?.recetas?.nombre ?? "Comida"}
              </Text>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => {
                  setShowMealOptionsModal(false);
                  setEditingMeal(mealOptionsTarget);
                  setEditMealTipo(mealOptionsTarget?.tipo_comida ?? "almuerzo");
                  setShowEditMealModal(true);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  ✏️ Editar tipo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#FEE2E2" }]}
                onPress={() => {
                  setShowMealOptionsModal(false);
                  if (mealOptionsTarget) handleDeleteMeal(mealOptionsTarget.id);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#DC2626" }]}>
                  🗑️ Eliminar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowMealOptionsModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Delete meal */}
        <Modal
          visible={showDeleteMealModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDeleteMealModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Eliminar comida</Text>
              <Text style={styles.confirmMessage}>
                ¿Eliminar esta comida del menú?
              </Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
                onPress={confirmDeleteMeal}
              >
                <Text style={styles.confirmBtnText}>Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowDeleteMealModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit meal tipo */}
        <Modal
          visible={showEditMealModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowEditMealModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditMealModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Editar comida</Text>
              <TouchableOpacity onPress={handleSaveEditMeal}>
                <Text style={styles.modalSave}>Guardar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.fieldLabel}>Momento del día</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {TIPOS_COMIDA.map((tipo) => {
                  const config = TIPO_CONFIG[tipo] ?? TIPO_CONFIG["snack"];
                  const isActive = editMealTipo === tipo;
                  return (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.tipoChip,
                        isActive && {
                          backgroundColor: config.bgColor,
                          borderColor: config.color,
                        },
                      ]}
                      onPress={() => setEditMealTipo(tipo)}
                    >
                      <Text style={{ fontSize: 16 }}>{config.icon}</Text>
                      <Text
                        style={[
                          styles.tipoChipText,
                          isActive && { color: config.color },
                        ]}
                      >
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Add meal */}
        <Modal
          visible={showAddMealModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowAddMealModal(false);
            setMealSearch("");
            setMealFilterKeyword(null);
            setMealFilterCategoria(null);
            setMealFilterDieta(null);
          }}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddMealModal(false);
                  setMealSearch("");
                  setMealFilterKeyword(null);
                  setMealFilterCategoria(null);
                  setMealFilterDieta(null);
                }}
              >
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Agregar comida</Text>
              <TouchableOpacity onPress={handleAddMeal} disabled={savingMeal}>
                <Text style={styles.modalSave}>
                  {savingMeal ? "..." : "Agregar"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Momento del día ── */}
              <Text style={styles.fieldLabel}>Momento del día</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 20 }}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {TIPOS_COMIDA.map((tipo) => {
                  const config = TIPO_CONFIG[tipo] ?? TIPO_CONFIG["snack"];
                  const isActive = selectedTipo === tipo;
                  return (
                    <TouchableOpacity
                      key={tipo}
                      style={[
                        styles.tipoChip,
                        isActive && {
                          backgroundColor: config.bgColor,
                          borderColor: config.color,
                        },
                      ]}
                      onPress={() => setSelectedTipo(tipo)}
                    >
                      <Text style={{ fontSize: 16 }}>{config.icon}</Text>
                      <Text
                        style={[
                          styles.tipoChipText,
                          isActive && { color: config.color },
                        ]}
                      >
                        {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* ── Buscar receta ── */}
              <Text style={styles.fieldLabel}>Receta (opcional)</Text>
              <View style={styles.searchBar}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre o palabra clave..."
                  placeholderTextColor="#94a3b8"
                  value={mealSearch}
                  onChangeText={setMealSearch}
                />
                {mealSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setMealSearch("")}>
                    <Text
                      style={{
                        color: "#94a3b8",
                        fontSize: 16,
                        paddingHorizontal: 8,
                      }}
                    >
                      ✕
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Filtro por categoría ── */}
              {(() => {
                const cats = Array.from(
                  new Set(recetas.map((r) => r.categoria).filter(Boolean)),
                ) as string[];
                if (cats.length === 0) return null;
                return (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                      Categoría
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.filterChip,
                          !mealFilterCategoria && styles.filterChipActive,
                        ]}
                        onPress={() => setMealFilterCategoria(null)}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            !mealFilterCategoria && styles.filterChipTextActive,
                          ]}
                        >
                          Todas
                        </Text>
                      </TouchableOpacity>
                      {cats.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.filterChip,
                            mealFilterCategoria === cat &&
                              styles.filterChipActive,
                          ]}
                          onPress={() =>
                            setMealFilterCategoria(
                              mealFilterCategoria === cat ? null : cat,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              mealFilterCategoria === cat &&
                                styles.filterChipTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              {/* ── Filtro por palabra clave ── */}
              {(() => {
                const allKws = Array.from(
                  new Set(recetas.flatMap((r) => r.palabras_clave ?? [])),
                );
                if (allKws.length === 0) return null;
                return (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                      Palabras clave
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      {allKws.map((kw) => (
                        <TouchableOpacity
                          key={kw}
                          style={[
                            styles.filterChip,
                            styles.filterChipKw,
                            mealFilterKeyword === kw &&
                              styles.filterChipKwActive,
                          ]}
                          onPress={() =>
                            setMealFilterKeyword(
                              mealFilterKeyword === kw ? null : kw,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              mealFilterKeyword === kw &&
                                styles.filterChipKwTextActive,
                            ]}
                          >
                            {kw}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              {/* ── Filtro dietario ── */}
              {(() => {
                const dietaOpts = [
                  { key: "es_vegano", label: "🌱 Vegano" },
                  { key: "es_vegetariano", label: "🥗 Vegetariano" },
                  { key: "sin_gluten", label: "🌾 Sin gluten" },
                  { key: "sin_lactosa", label: "🥛 Sin lactosa" },
                ];
                return (
                  <View style={{ marginTop: 12, marginBottom: 16 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>
                      Especificaciones dietarias
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    >
                      {dietaOpts.map((d) => (
                        <TouchableOpacity
                          key={d.key}
                          style={[
                            styles.filterChip,
                            styles.filterChipDieta,
                            mealFilterDieta === d.key &&
                              styles.filterChipDietaActive,
                          ]}
                          onPress={() =>
                            setMealFilterDieta(
                              mealFilterDieta === d.key ? null : d.key,
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              mealFilterDieta === d.key &&
                                styles.filterChipDietaTextActive,
                            ]}
                          >
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              {/* ── Lista de recetas filtrada ── */}
              {(() => {
                const q = mealSearch.toLowerCase();
                const filtered = recetas.filter((r) => {
                  const matchSearch =
                    !q ||
                    r.nombre.toLowerCase().includes(q) ||
                    (r.palabras_clave ?? []).some((kw) =>
                      kw.toLowerCase().includes(q),
                    );
                  const matchKw =
                    !mealFilterKeyword ||
                    (r.palabras_clave ?? []).includes(mealFilterKeyword);
                  const matchCat =
                    !mealFilterCategoria || r.categoria === mealFilterCategoria;
                  const matchDieta =
                    !mealFilterDieta || (r as any)[mealFilterDieta] === true;
                  return matchSearch && matchKw && matchCat && matchDieta;
                });

                return (
                  <>
                    {/* "Sin receta" option */}
                    <TouchableOpacity
                      style={[
                        styles.recetaCard,
                        !selectedRecetaId && styles.recetaCardActive,
                      ]}
                      onPress={() => setSelectedRecetaId(null)}
                    >
                      <View style={styles.recetaCardLeft}>
                        <Text style={{ fontSize: 24 }}>🍴</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.recetaCardNombre,
                              !selectedRecetaId && { color: "#1B4F72" },
                            ]}
                          >
                            Sin receta específica
                          </Text>
                          <Text style={styles.recetaCardSub}>
                            Solo registrar el momento
                          </Text>
                        </View>
                      </View>
                      {!selectedRecetaId && (
                        <Text style={styles.recetaCardCheck}>✓</Text>
                      )}
                    </TouchableOpacity>

                    {filtered.length === 0 && mealSearch.length > 0 && (
                      <View style={styles.emptySearch}>
                        <Text style={styles.emptySearchIcon}>🔍</Text>
                        <Text style={styles.emptySearchText}>
                          Sin resultados para "{mealSearch}"
                        </Text>
                      </View>
                    )}

                    {filtered.map((r) => {
                      const isSelected = selectedRecetaId === r.id;
                      const tipoConf = TIPO_CONFIG[r.tipo_comida] ?? {
                        icon: "🍴",
                        color: "#475569",
                        bgColor: "#f1f5f9",
                      };
                      const tiempoTotal =
                        (r.tiempo_preparacion ?? 0) + (r.tiempo_coccion ?? 0);
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[
                            styles.recetaCard,
                            isSelected && styles.recetaCardActive,
                          ]}
                          onPress={() => setSelectedRecetaId(r.id)}
                        >
                          <View style={styles.recetaCardLeft}>
                            <Text style={{ fontSize: 22 }}>
                              {tipoConf.icon}
                            </Text>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.recetaCardNombre,
                                  isSelected && { color: "#1B4F72" },
                                ]}
                              >
                                {r.nombre}
                              </Text>
                              {r.descripcion ? (
                                <Text
                                  style={styles.recetaCardSub}
                                  numberOfLines={1}
                                >
                                  {r.descripcion}
                                </Text>
                              ) : null}
                              <View style={styles.recetaCardMeta}>
                                {tiempoTotal > 0 && (
                                  <View style={styles.recetaMetaChip}>
                                    <Text style={styles.recetaMetaChipText}>
                                      ⏱ {tiempoTotal}min
                                    </Text>
                                  </View>
                                )}
                                {r.es_vegano && (
                                  <View
                                    style={[
                                      styles.recetaMetaChip,
                                      { backgroundColor: "#D1FAE5" },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.recetaMetaChipText,
                                        { color: "#065F46" },
                                      ]}
                                    >
                                      🌱
                                    </Text>
                                  </View>
                                )}
                                {r.es_vegetariano && !r.es_vegano && (
                                  <View
                                    style={[
                                      styles.recetaMetaChip,
                                      { backgroundColor: "#D1FAE5" },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.recetaMetaChipText,
                                        { color: "#065F46" },
                                      ]}
                                    >
                                      🥗
                                    </Text>
                                  </View>
                                )}
                                {r.sin_gluten && (
                                  <View
                                    style={[
                                      styles.recetaMetaChip,
                                      { backgroundColor: "#FEF9C3" },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.recetaMetaChipText,
                                        { color: "#854D0E" },
                                      ]}
                                    >
                                      🌾
                                    </Text>
                                  </View>
                                )}
                                {r.categoria ? (
                                  <View style={styles.recetaMetaChip}>
                                    <Text style={styles.recetaMetaChipText}>
                                      {r.categoria}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              {(r.palabras_clave ?? []).length > 0 && (
                                <View style={styles.recetaCardKws}>
                                  {(r.palabras_clave as string[])
                                    .slice(0, 3)
                                    .map((kw) => (
                                      <View key={kw} style={styles.recetaKwTag}>
                                        <Text style={styles.recetaKwTagText}>
                                          {kw}
                                        </Text>
                                      </View>
                                    ))}
                                </View>
                              )}
                            </View>
                          </View>
                          {isSelected && (
                            <Text style={styles.recetaCardCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Add gasto */}
        <Modal
          visible={showAddGastoModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowAddGastoModal(false);
            setEditingGasto(null);
            setGastoNombre("");
            setGastoMonto("");
            setGastoCategoria("comida");
            setGastoPagadoPor(null);
            setGastoParticipantes({});
          }}
          onShow={() => {
            if (!editingGasto) initGastoParticipantes();
          }}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddGastoModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingGasto ? "Editar gasto" : "Agregar gasto"}
              </Text>
              <TouchableOpacity
                onPress={handleSaveGasto}
                disabled={savingGasto}
              >
                <Text style={styles.modalSave}>
                  {savingGasto ? "..." : "Guardar"}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nombre del gasto *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Mercado, Gasolina, Restaurante..."
                  placeholderTextColor="#94a3b8"
                  value={gastoNombre}
                  onChangeText={setGastoNombre}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Monto (COP) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 150000"
                  placeholderTextColor="#94a3b8"
                  value={gastoMonto}
                  onChangeText={setGastoMonto}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Categoría *</Text>
                <View style={styles.categoriasGrid}>
                  {CATEGORIAS.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoriaBtn,
                        gastoCategoria === cat.key && styles.categoriaBtnActive,
                      ]}
                      onPress={() => {
                        setGastoCategoria(cat.key);
                      }}
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
              </View>

              {/* Participantes del gasto (solo para categorías distintas a comida) */}
              {gastoCategoria !== "comida" && participaciones.length > 0 && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    ¿Quién participa en este gasto?
                  </Text>
                  <Text style={[styles.fieldHint, { marginBottom: 10 }]}>
                    Desactiva quien no participa — afecta el cálculo de su cuota
                  </Text>
                  {familiasList.map((fam, fidx) => {
                    const miembros = participaciones.filter(
                      (p) => p.familia_id === fam.id,
                    );
                    if (miembros.length === 0) return null;
                    const color = UF_COLORS[fidx % UF_COLORS.length];
                    return (
                      <View
                        key={fam.id}
                        style={[
                          styles.gastoPartFamilia,
                          { borderLeftColor: color },
                        ]}
                      >
                        <Text
                          style={[styles.gastoPartFamiliaNombre, { color }]}
                        >
                          {fam.nombre}
                        </Text>
                        {miembros.map((p) => {
                          const activo = gastoPartActivoForModal(p.id);
                          return (
                            <View key={p.id} style={styles.gastoPartRow}>
                              <Text
                                style={[
                                  styles.gastoPartNombre,
                                  { color: activo ? "#1e293b" : "#94a3b8" },
                                ]}
                              >
                                {p.personas.nombre}
                                <Text style={styles.gastoPartFactor}>
                                  {" "}
                                  · Factor {p.factor ?? 1}
                                </Text>
                              </Text>
                              <Switch
                                value={activo}
                                onValueChange={(v) =>
                                  setGastoParticipantes((prev) => ({
                                    ...prev,
                                    [p.id]: v,
                                  }))
                                }
                                trackColor={{
                                  false: "#e2e8f0",
                                  true: color + "66",
                                }}
                                thumbColor={activo ? color : "#94a3b8"}
                              />
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>¿Quién pagó? *</Text>
                {participaciones.length === 0 ? (
                  <Text style={styles.noPersonas}>
                    No hay participantes en el paseo.
                  </Text>
                ) : (
                  participaciones.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.personaOption,
                        gastoPagadoPor === p.persona_id &&
                          styles.personaOptionActive,
                      ]}
                      onPress={() => setGastoPagadoPor(p.persona_id)}
                    >
                      <Text
                        style={[
                          styles.personaOptionText,
                          gastoPagadoPor === p.persona_id &&
                            styles.personaOptionTextActive,
                        ]}
                      >
                        {p.personas.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Gasto options */}
        <Modal
          visible={showGastoOptionsModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowGastoOptionsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.estadoModalBox}>
              <Text style={styles.estadoModalTitle}>
                {gastoOptionsTarget?.nombre}
              </Text>
              <Text
                style={[
                  styles.gastoCategoriaLabel,
                  { textAlign: "center", marginBottom: 12, fontSize: 13 },
                ]}
              >
                {CATEGORIAS.find(
                  (c) => c.key === (gastoOptionsTarget?.categoria ?? "otros"),
                )?.label ?? "📦 Otros"}{" "}
                · {formatCOP(gastoOptionsTarget?.monto ?? 0)}
              </Text>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#EFF6FF" }]}
                onPress={() => {
                  setShowGastoOptionsModal(false);
                  openEditGasto(gastoOptionsTarget);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#1B4F72" }]}>
                  ✏️ Editar gasto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.estadoOption, { backgroundColor: "#FEE2E2" }]}
                onPress={() => {
                  setShowGastoOptionsModal(false);
                  setDeleteGastoTarget(gastoOptionsTarget);
                  setShowDeleteGastoModal(true);
                }}
              >
                <Text style={[styles.estadoOptionText, { color: "#DC2626" }]}>
                  🗑️ Eliminar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowGastoOptionsModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Delete gasto */}
        <Modal
          visible={showDeleteGastoModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDeleteGastoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Eliminar gasto</Text>
              <Text style={styles.confirmMessage}>
                ¿Eliminar "{deleteGastoTarget?.nombre}"?
              </Text>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
                onPress={confirmDeleteGasto}
              >
                <Text style={styles.confirmBtnText}>Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.estadoCancel}
                onPress={() => setShowDeleteGastoModal(false)}
              >
                <Text style={styles.estadoCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  fieldHint: { fontSize: 11, color: "#94a3b8" },
  mealPorciones: { fontSize: 12, color: "#64748b", marginTop: 3 },

  // Header
  header: {
    backgroundColor: "#1B4F72",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 8 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  estadoBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoText: { fontSize: 11, fontWeight: "700" },

  // Tabs
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1B4F72" },
  tabText: { fontSize: 11, fontWeight: "600", color: "#94a3b8" },
  tabTextActive: { color: "#1B4F72" },

  content: { padding: 16, paddingBottom: 40 },
  map: { width: "100%", height: 200, borderRadius: 12, marginTop: 8 },
  mapLinkCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mapLinkIcon: { fontSize: 32 },
  mapLinkInfo: { flex: 1 },
  mapLinkTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  mapLinkSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  mapLinkArrow: { fontSize: 20, color: "#1B4F72", fontWeight: "700" },

  // Trip photo
  tripPhotoContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  tripPhoto: { width: "100%", height: 200 },
  tripPhotoPlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: "#1B4F72",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  tripPhotoIcon: { fontSize: 40, marginBottom: 8 },
  tripPhotoText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },

  // Section
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  editActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  editText: { fontSize: 13, color: "#1B4F72", fontWeight: "600" },
  cancelText: { fontSize: 13, color: "#64748b" },
  saveBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  infoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  infoLabel: { fontSize: 13, color: "#94a3b8", fontWeight: "600", width: 90 },
  infoValue: { fontSize: 13, color: "#1e293b", flex: 1, fontWeight: "500" },
  link: { color: "#1B4F72", fontWeight: "700" },

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
  row: { flexDirection: "row" },

  inviteCard: {
    backgroundColor: "#1B4F72",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  inviteLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  inviteCode: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    marginBottom: 6,
  },
  inviteHint: { color: "rgba(255,255,255,0.5)", fontSize: 11 },

  deleteButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  deleteButtonText: { color: "#dc2626", fontSize: 15, fontWeight: "700" },

  addBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Familia card
  familiaCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  familiaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  familiaAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  familiaAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  familiaAvatarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  familiaTitulo: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  familiaCount: { fontSize: 11, color: "#94a3b8", marginTop: 1 },

  participanteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18, borderWidth: 2 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  accountBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  participanteInfo: { flex: 1 },
  participanteNombre: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  participanteSub: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  chevron: { fontSize: 20, color: "#cbd5e1" },

  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  emptySub: { fontSize: 13, color: "#94a3b8", textAlign: "center" },

  // Date selector
  dateSelector: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    maxHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  dateChipActive: { borderColor: "#1B4F72", backgroundColor: "#1B4F72" },
  dateChipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  dateChipTextActive: { color: "#fff" },

  // Meal card
  mealCard: {
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
  mealCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tipoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipoBadgeText: { fontSize: 12, fontWeight: "700" },
  mealNombre: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  longPressHint: { fontSize: 10, color: "#cbd5e1" },
  addMealButton: {
    borderWidth: 2,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  addMealButtonText: { color: "#64748b", fontSize: 14, fontWeight: "600" },

  // Meal detail modal content
  mealDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    padding: 16,
  },
  mealDetailTipo: { fontSize: 15, fontWeight: "700" },
  mealDetailFecha: { fontSize: 12, color: "#64748b", marginTop: 2 },
  mealDetailPorciones: { alignItems: "center" },
  mealDetailPorcionesNum: { fontSize: 28, fontWeight: "800", color: "#1B4F72" },
  mealDetailPorcionesSub: { fontSize: 10, color: "#64748b" },
  mealPartFamilia: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 16 },
  mealPartFamiliaNombre: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealPartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  mealPartInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  mealPartAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  mealPartNombre: { fontSize: 14, fontWeight: "600" },
  mealPartFactor: { fontSize: 11, color: "#94a3b8" },

  // Gastos
  gastosSubTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  gastosSubTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  gastosSubTabActive: { borderBottomColor: "#1B4F72" },
  gastosSubTabText: { fontSize: 12, fontWeight: "600", color: "#94a3b8" },
  gastosSubTabTextActive: { color: "#1B4F72" },
  gastosTotalLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  gastosSubHint: { fontSize: 12, color: "#94a3b8" },
  gastoCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gastoCardLeft: { flex: 1 },
  gastoNombre: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  gastoPagadoPorText: { fontSize: 12, color: "#64748b", marginTop: 3 },
  gastoCardRight: { alignItems: "flex-end" },
  gastoMonto: { fontSize: 16, fontWeight: "800", color: "#1B4F72" },
  gastoHint: { fontSize: 10, color: "#cbd5e1", marginTop: 2 },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  balanceNombre: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  balanceMiembros: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  balanceSaldo: { fontSize: 16, fontWeight: "800" },
  balanceRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  balanceItem: { flex: 1, alignItems: "center" },
  balanceItemLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 2,
  },
  balanceItemValue: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  balanceDivider: { width: 1, height: 28, backgroundColor: "#e2e8f0" },
  balanceBarBg: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  balanceBarFill: { height: 6, borderRadius: 3 },
  liquidacionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  liquidacionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  liquidacionDe: { fontSize: 14, fontWeight: "700", color: "#DC2626" },
  liquidacionArrow: { fontSize: 16, color: "#94a3b8" },
  liquidacionPara: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  liquidacionMonto: { fontSize: 16, fontWeight: "800", color: "#1B4F72" },

  // Categoria
  categoriasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoriaBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  categoriaBtnActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  categoriaBtnText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  categoriaBtnTextActive: { color: "#1B4F72" },
  gastoCategoriaLabel: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  gastoPartFamilia: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 14 },
  gastoPartFamiliaNombre: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gastoPartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  gastoPartNombre: { fontSize: 14, fontWeight: "600", flex: 1 },
  gastoPartFactor: { fontSize: 12, fontWeight: "400", color: "#94a3b8" },
  balanceCatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  balanceCatLabel: { fontSize: 12, color: "#64748b" },
  balanceCatValue: { fontSize: 12, fontWeight: "600", color: "#1e293b" },

  // Resumen por persona
  personaBalanceGroup: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 20,
  },
  personaBalanceGroupNombre: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  personaBalanceCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  personaBalanceTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  personaBalanceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  personaBalanceNombre: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  personaBalanceFactor: { fontSize: 11, color: "#94a3b8", marginTop: 1 },

  // Export
  // Liquidaciones pagadas
  liquidacionCardPagada: { opacity: 0.55, backgroundColor: "#f0fdf4" },
  liquidacionTextPagada: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  liqCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  liqCheckboxPagada: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  liqCheckmark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  liquidadoPrompt: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    alignItems: "center",
    gap: 12,
  },
  liquidadoPromptText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#16a34a",
    textAlign: "center",
  },
  liquidadoBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  liquidadoBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  exportRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  exportBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#1B4F72",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnPDF: { backgroundColor: "#1B4F72", borderColor: "#1B4F72" },
  exportBtnText: { fontSize: 13, fontWeight: "700", color: "#1B4F72" },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  estadoModalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
  },
  estadoModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 16,
    textAlign: "center",
  },
  estadoOption: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    alignItems: "center",
  },
  estadoOptionText: { fontSize: 15, fontWeight: "700" },
  estadoCancel: { alignItems: "center", marginTop: 8 },
  estadoCancelText: { color: "#64748b", fontSize: 14 },
  confirmBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  confirmBtn: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  familiaModalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    alignItems: "center",
  },
  familiaModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  familiaModalSub: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  familiaInput: {
    borderWidth: 2,
    borderColor: "#1B4F72",
    borderRadius: 12,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    width: 120,
    paddingVertical: 10,
    color: "#1e293b",
    marginBottom: 20,
  },
  familiaModalButtons: { flexDirection: "row", gap: 12, width: "100%" },
  familiaModalCancel: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  familiaModalCancelText: { color: "#64748b", fontWeight: "600" },
  familiaModalSave: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#1B4F72",
    alignItems: "center",
  },
  familiaModalSaveText: { color: "#fff", fontWeight: "700" },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalCancel: { fontSize: 15, color: "#64748b", width: 70 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  modalSave: {
    fontSize: 15,
    color: "#1B4F72",
    fontWeight: "700",
    width: 70,
    textAlign: "right",
  },
  modalContent: { padding: 20 },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Familia photo in edit modal
  familiaPhotoBtn: { alignSelf: "center", marginBottom: 20 },
  familiaPhotoBtnImg: { width: 96, height: 96, borderRadius: 48 },
  familiaPhotoBtnPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  familiaPhotoBtnText: { fontSize: 12, color: "#94a3b8", marginTop: 4 },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 4 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: "#1e293b" },
  searchResults: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchResultItemActive: { backgroundColor: "#EFF6FF" },
  searchResultDot: { width: 8, height: 8, borderRadius: 4 },
  searchResultText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  searchResultTextActive: { color: "#1B4F72", fontWeight: "700" },
  selectedPersonaBadge: {
    marginTop: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
  },
  selectedPersonaText: { color: "#1B4F72", fontWeight: "700", fontSize: 13 },
  noPersonas: { fontSize: 13, color: "#94a3b8", fontStyle: "italic" },

  // Toggles / options
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  toggleBtnActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  toggleTextActive: { color: "#1B4F72" },
  personaOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  personaOptionActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  personaOptionText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  personaOptionTextActive: { color: "#1B4F72", fontWeight: "700" },

  // Factor presets
  factorSliderRow: { flexDirection: "row", gap: 8 },
  factorPresetBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  factorPresetBtnActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  factorPresetText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  factorPresetTextActive: { color: "#1B4F72" },

  // Meal modal
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
  recetaOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    backgroundColor: "#f8fafc",
  },
  recetaOptionActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  recetaOptionText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  recetaOptionTextActive: { color: "#1B4F72", fontWeight: "700" },

  // New meal modal styles
  tipoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tipoChipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  filterChipActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  filterChipTextActive: { color: "#1B4F72" },
  filterChipKw: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  filterChipKwActive: { borderColor: "#1D4ED8", backgroundColor: "#DBEAFE" },
  filterChipKwTextActive: { color: "#1D4ED8" },
  filterChipDieta: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  filterChipDietaActive: { borderColor: "#16a34a", backgroundColor: "#DCFCE7" },
  filterChipDietaTextActive: { color: "#15803D" },

  recetaCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 8,
  },
  recetaCardActive: { borderColor: "#1B4F72", backgroundColor: "#EFF6FF" },
  recetaCardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  recetaCardNombre: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  recetaCardSub: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  recetaCardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  recetaMetaChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  recetaMetaChipText: { fontSize: 11, color: "#475569", fontWeight: "600" },
  recetaCardKws: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  recetaKwTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
  },
  recetaKwTagText: { fontSize: 10, color: "#1D4ED8", fontWeight: "600" },
  recetaCardCheck: {
    fontSize: 18,
    color: "#1B4F72",
    fontWeight: "800",
    marginLeft: 8,
  },

  emptySearch: { alignItems: "center", paddingVertical: 24 },
  emptySearchIcon: { fontSize: 32, marginBottom: 8 },
  emptySearchText: { fontSize: 14, color: "#64748b" },
});
