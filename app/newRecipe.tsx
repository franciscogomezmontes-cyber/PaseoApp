import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const TIPOS_COMIDA = [
  "desayuno",
  "medias nueves",
  "almuerzo",
  "onces",
  "cena",
  "snack",
];

const CATEGORIAS = [
  "Plato fuerte",
  "Entrada",
  "Aperitivo",
  "Sopa",
  "Ensalada",
  "Postre",
  "Cóctel",
  "Bebida con alcohol",
  "Bebida sin alcohol",
  "Salsa / Aderezo",
  "Picadas",
  "Agua",
];

const TAGS = [
  { key: "es_vegano", label: "🌱 Vegano" },
  { key: "es_vegetariano", label: "🥦 Vegetariano" },
  { key: "es_picante", label: "🌶️ Picante" },
  { key: "contiene_nueces", label: "🥜 Nueces" },
  { key: "sin_gluten", label: "🌾 Sin gluten" },
  { key: "sin_lactosa", label: "🥛 Sin lactosa" },
];

const UTENSILIOS_PREDEFINIDOS = [
  "Horno",
  "Big Green Egg",
  "Parrilla",
  "Estufa",
  "Sartén",
  "Olla",
  "Olla a presión",
  "Olla arrocera",
  "Licuadora",
  "Batidora",
  "Procesador de alimentos",
  "Mixer de mano",
  "Rodillo",
  "Moldes para horno",
  "Refractaria",
  "Tabla de cortar",
  "Cuchillo de chef",
  "Pelador",
  "Rallador",
  "Colador / Cernidor",
  "Manga pastelera",
];

interface IngredienteRow {
  ingrediente_id: string;
  nombre: string;
  cantidad: string;
  unidad: string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function NewRecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const savingRef = useRef(0);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Basic info
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [porciones, setPorciones] = useState("4");
  const [tipoComida, setTipoComida] = useState("almuerzo");
  const [categoria, setCategoria] = useState("Plato fuerte");
  const [instrucciones, setInstrucciones] = useState("");
  const [esPublica, setEsPublica] = useState(true);

  // New fields
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [tiempoPrep, setTiempoPrep] = useState("");
  const [tiempoCoccion, setTiempoCoccion] = useState("");
  const [creditos, setCreditos] = useState("");
  const [utensilios, setUtensilios] = useState<string[]>([]);
  const [palabrasClave, setPalabrasClave] = useState<string[]>([]);
  const [nuevaPalabra, setNuevaPalabra] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // Tags
  const [tags, setTags] = useState<Record<string, boolean>>({
    es_vegano: false,
    es_vegetariano: false,
    es_picante: false,
    contiene_nueces: false,
    sin_gluten: false,
    sin_lactosa: false,
  });

  // Ingredientes
  const [ingredientes, setIngredientes] = useState<IngredienteRow[]>([]);
  const [catalogoIngredientes, setCatalogoIngredientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [showCatalogo, setShowCatalogo] = useState(false);

  // Modals
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateIngModal, setShowCreateIngModal] = useState(false);
  const [newIngNombre, setNewIngNombre] = useState("");
  const [newIngUnidad, setNewIngUnidad] = useState("g");

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setShowErrorModal(true);
  };

  useEffect(() => {
    loadCatalogo();
    if (isEditing) loadReceta();
  }, [id]);

  const loadCatalogo = async () => {
    const { data } = await supabase
      .from("ingredientes")
      .select("*")
      .order("nombre");
    setCatalogoIngredientes(data ?? []);
  };

  const loadReceta = async () => {
    setLoading(true);
    const { data: receta } = await supabase
      .from("recetas")
      .select("*")
      .eq("id", id)
      .single();
    if (receta) {
      setNombre(receta.nombre ?? "");
      setDescripcion(receta.descripcion ?? "");
      setPorciones(String(receta.porciones_base ?? 4));
      setTipoComida(receta.tipo_comida ?? "almuerzo");
      setCategoria(receta.categoria ?? "Plato fuerte");
      setInstrucciones(receta.instrucciones ?? "");
      setEsPublica(receta.es_publica ?? true);
      setFotoUrl(receta.foto_url ?? null);
      setTiempoPrep(
        receta.tiempo_preparacion ? String(receta.tiempo_preparacion) : "",
      );
      setTiempoCoccion(
        receta.tiempo_coccion ? String(receta.tiempo_coccion) : "",
      );
      setCreditos(receta.creditos ?? "");
      setUtensilios(receta.utensilios ?? []);
      setPalabrasClave(receta.palabras_clave ?? []);
      setTags({
        es_vegano: receta.es_vegano ?? false,
        es_vegetariano: receta.es_vegetariano ?? false,
        es_picante: receta.es_picante ?? false,
        contiene_nueces: receta.contiene_nueces ?? false,
        sin_gluten: receta.sin_gluten ?? false,
        sin_lactosa: receta.sin_lactosa ?? false,
      });
    }
    const { data: ingData } = await supabase
      .from("receta_ingredientes")
      .select("*, ingredientes(nombre, unidad_base)")
      .eq("receta_id", id);
    if (ingData) {
      setIngredientes(
        ingData.map((i: any) => ({
          ingrediente_id: i.ingrediente_id,
          nombre: i.ingredientes?.nombre ?? "",
          cantidad: String(
            Math.round(
              i.cantidad_por_porcion * (receta?.porciones_base ?? 4) * 100,
            ) / 100,
          ),
          unidad: i.ingredientes?.unidad_base ?? "",
        })),
      );
    }
    setLoading(false);
  };

  // ─── Photo upload ───
  const handlePickFoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingFoto(true);
    try {
      const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const fileName = `receta_${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("recetas")
        .upload(fileName, arrayBuffer, {
          contentType: `image/${ext}`,
          upsert: true,
        });
      if (uploadError) {
        showError(uploadError.message);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("recetas")
        .getPublicUrl(fileName);
      setFotoUrl(urlData.publicUrl);
    } catch (e: any) {
      showError(e.message ?? "Error subiendo foto");
    } finally {
      setUploadingFoto(false);
    }
  };

  // ─── Utensilios ───
  const toggleUtensilio = (u: string) =>
    setUtensilios((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u],
    );

  // ─── Palabras clave ───
  const agregarPalabra = () => {
    const trimmed = nuevaPalabra.trim().toLowerCase();
    if (!trimmed || palabrasClave.includes(trimmed)) {
      setNuevaPalabra("");
      return;
    }
    setPalabrasClave((prev) => [...prev, trimmed]);
    setNuevaPalabra("");
  };
  const quitarPalabra = (p: string) =>
    setPalabrasClave((prev) => prev.filter((x) => x !== p));

  // ─── Ingredientes ───
  const filteredCatalogo = catalogoIngredientes.filter(
    (i) =>
      i.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
      !ingredientes.find((ing) => ing.ingrediente_id === i.id),
  );

  const handleAddIngrediente = (ing: any) => {
    setIngredientes((prev) => [
      ...prev,
      {
        ingrediente_id: ing.id,
        nombre: ing.nombre,
        cantidad: "",
        unidad: ing.unidad_base,
      },
    ]);
    setBusqueda("");
    setShowCatalogo(false);
  };

  const openCreateIng = () => {
    setNewIngNombre(busqueda);
    setNewIngUnidad("g");
    setShowCreateIngModal(true);
  };

  const handleCreateIngrediente = async () => {
    if (!newIngNombre.trim()) return;
    const { data: existing } = await supabase
      .from("ingredientes")
      .select("*")
      .ilike("nombre", newIngNombre.trim())
      .maybeSingle();
    const ing =
      existing ??
      (await (async () => {
        const { data, error } = await supabase
          .from("ingredientes")
          .insert({
            nombre: newIngNombre.trim(),
            unidad_base: newIngUnidad,
            categoria: "Otros",
          })
          .select()
          .single();
        if (error) {
          showError(error.message);
          return null;
        }
        return data;
      })());
    if (!ing) return;
    setShowCreateIngModal(false);
    await loadCatalogo();
    handleAddIngrediente(ing);
  };

  const handleRemoveIngrediente = (ingId: string) =>
    setIngredientes((prev) => prev.filter((i) => i.ingrediente_id !== ingId));
  const handleCantidadChange = (ingId: string, cantidad: string) =>
    setIngredientes((prev) =>
      prev.map((i) => (i.ingrediente_id === ingId ? { ...i, cantidad } : i)),
    );

  // ─── Save ───
  const saveIngredientes = async (recetaId: string) => {
    const seen = new Set<string>();
    const deduped = ingredientes.filter((ing) => {
      if (seen.has(ing.ingrediente_id)) return false;
      seen.add(ing.ingrediente_id);
      return true;
    });
    const rows = deduped.map((i) => ({
      receta_id: recetaId,
      ingrediente_id: i.ingrediente_id,
      cantidad_por_porcion: parseFloat(i.cantidad) / (parseInt(porciones) || 4),
    }));
    await supabase
      .from("receta_ingredientes")
      .delete()
      .eq("receta_id", recetaId);
    if (rows.length === 0) return true;
    const { error } = await supabase
      .from("receta_ingredientes")
      .upsert(rows, { onConflict: "receta_id,ingrediente_id" });
    if (error) {
      showError("Error guardando ingredientes: " + error.message);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    const now = Date.now();
    if (now - savingRef.current < 2000) return;
    savingRef.current = now;
    if (!nombre.trim()) {
      showError("El nombre es obligatorio.");
      return;
    }
    if (ingredientes.some((i) => !i.cantidad)) {
      showError("Completa la cantidad de todos los ingredientes.");
      return;
    }
    setSaving(true);

    const recetaPayload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      porciones_base: parseInt(porciones) || 4,
      tipo_comida: tipoComida,
      categoria,
      instrucciones: instrucciones.trim(),
      es_publica: esPublica,
      foto_url: fotoUrl,
      tiempo_preparacion: tiempoPrep ? parseInt(tiempoPrep) : null,
      tiempo_coccion: tiempoCoccion ? parseInt(tiempoCoccion) : null,
      creditos: creditos.trim() || null,
      utensilios: utensilios.length > 0 ? utensilios : null,
      palabras_clave: palabrasClave.length > 0 ? palabrasClave : null,
      ...tags,
    };

    let recetaId = id;
    if (isEditing) {
      const { error } = await supabase
        .from("recetas")
        .update(recetaPayload)
        .eq("id", id);
      if (error) {
        showError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("recetas")
        .insert(recetaPayload)
        .select()
        .single();
      if (error) {
        showError(error.message);
        setSaving(false);
        return;
      }
      recetaId = data.id;
    }

    const ok = await saveIngredientes(recetaId!);
    if (!ok) {
      setSaving(false);
      return;
    }
    setSaving(false);
    setSuccessMsg(
      `"${nombre}" fue ${isEditing ? "actualizada" : "agregada"} al catálogo.`,
    );
    setShowSuccessModal(true);
  };

  const handleDelete = async () => {
    setShowDeleteModal(false);
    await supabase.from("recetas").delete().eq("id", id);
    router.back();
    router.back();
  };

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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {isEditing ? "✏️ Editar receta" : "Nueva receta"}
            </Text>
            {isEditing && (
              <TouchableOpacity onPress={() => setShowDeleteModal(true)}>
                <Text style={styles.deleteText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── FOTO ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📷 Foto del plato</Text>
            {fotoUrl ? (
              <View style={styles.fotoContainer}>
                <Image
                  source={{ uri: fotoUrl }}
                  style={styles.fotoPreview}
                  resizeMode="cover"
                />
                <View style={styles.fotoActions}>
                  <TouchableOpacity
                    style={styles.fotoBtn}
                    onPress={handlePickFoto}
                    disabled={uploadingFoto}
                  >
                    <Text style={styles.fotoBtnText}>
                      {uploadingFoto ? "Subiendo..." : "✏️ Cambiar foto"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.fotoBtn, styles.fotoBtnDanger]}
                    onPress={() => setFotoUrl(null)}
                  >
                    <Text style={[styles.fotoBtnText, { color: "#ef4444" }]}>
                      🗑️ Quitar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.fotoPlaceholder}
                onPress={handlePickFoto}
                disabled={uploadingFoto}
              >
                {uploadingFoto ? (
                  <ActivityIndicator color="#1B4F72" />
                ) : (
                  <>
                    <Text style={styles.fotoPlaceholderIcon}>🍽️</Text>
                    <Text style={styles.fotoPlaceholderText}>
                      Toca para agregar foto
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* ── INFORMACIÓN BÁSICA ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Información básica</Text>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej: Arroz con pollo"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Breve descripción..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Créditos</Text>
              <TextInput
                style={styles.input}
                value={creditos}
                onChangeText={setCreditos}
                placeholder="Ej: Receta de la abuela María"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Porciones base</Text>
              <View style={styles.scalerRow}>
                <TouchableOpacity
                  style={styles.scalerBtn}
                  onPress={() =>
                    setPorciones((p) => String(Math.max(1, parseInt(p) - 1)))
                  }
                >
                  <Text style={styles.scalerBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.scalerNumber}>{porciones}</Text>
                <TouchableOpacity
                  style={styles.scalerBtn}
                  onPress={() => setPorciones((p) => String(parseInt(p) + 1))}
                >
                  <Text style={styles.scalerBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.field}>
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Receta pública</Text>
                <Switch
                  value={esPublica}
                  onValueChange={setEsPublica}
                  trackColor={{ false: "#e2e8f0", true: "#1B4F72" }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={styles.fieldHint}>
                Las recetas públicas son visibles para todos los usuarios
              </Text>
            </View>
          </View>

          {/* ── TIEMPOS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏱ Tiempos</Text>
            <View style={styles.tiemposRow}>
              <View style={styles.tiempoField}>
                <Text style={styles.fieldLabel}>Preparación (min)</Text>
                <TextInput
                  style={styles.input}
                  value={tiempoPrep}
                  onChangeText={setTiempoPrep}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.tiempoField}>
                <Text style={styles.fieldLabel}>Cocción (min)</Text>
                <TextInput
                  style={styles.input}
                  value={tiempoCoccion}
                  onChangeText={setTiempoCoccion}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
            </View>
            {(tiempoPrep || tiempoCoccion) && (
              <Text style={styles.tiempoTotal}>
                Total:{" "}
                {parseInt(tiempoPrep || "0") + parseInt(tiempoCoccion || "0")}{" "}
                min
              </Text>
            )}
          </View>

          {/* ── CLASIFICACIÓN ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍽️ Clasificación</Text>
            <Text style={styles.fieldLabel}>Momento del día</Text>
            <View style={styles.chipRow}>
              {TIPOS_COMIDA.map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.chip,
                    tipoComida === tipo && styles.chipActive,
                  ]}
                  onPress={() => setTipoComida(tipo)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      tipoComida === tipo && styles.chipTextActive,
                    ]}
                  >
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              Categoría
            </Text>
            <View style={styles.chipRow}>
              {CATEGORIAS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, categoria === cat && styles.chipActive]}
                  onPress={() => setCategoria(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      categoria === cat && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── ETIQUETAS DIETÉTICAS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ Etiquetas dietéticas</Text>
            <View style={styles.tagsGrid}>
              {TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.key}
                  style={[
                    styles.tagChip,
                    tags[tag.key] && styles.tagChipActive,
                  ]}
                  onPress={() =>
                    setTags((prev) => ({ ...prev, [tag.key]: !prev[tag.key] }))
                  }
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      tags[tag.key] && styles.tagChipTextActive,
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── PALABRAS CLAVE ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔖 Palabras clave</Text>
            <Text style={styles.fieldHint}>
              Facilitan la búsqueda en el recetario
            </Text>
            <View style={styles.kwInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={nuevaPalabra}
                onChangeText={setNuevaPalabra}
                placeholder="Ej: fácil, navidad, parrilla..."
                placeholderTextColor="#94a3b8"
                onSubmitEditing={agregarPalabra}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.kwAddBtn}
                onPress={agregarPalabra}
              >
                <Text style={styles.kwAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {palabrasClave.length > 0 && (
              <View style={[styles.chipRow, { marginTop: 10 }]}>
                {palabrasClave.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={styles.kwTag}
                    onPress={() => quitarPalabra(p)}
                  >
                    <Text style={styles.kwTagText}>{p} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── UTENSILIOS ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🍳 Equipos y utensilios</Text>
            <Text style={styles.fieldHint}>
              Selecciona los que necesita esta receta
            </Text>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              {UTENSILIOS_PREDEFINIDOS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.chip,
                    utensilios.includes(u) && styles.chipActive,
                  ]}
                  onPress={() => toggleUtensilio(u)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      utensilios.includes(u) && styles.chipTextActive,
                    ]}
                  >
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── INGREDIENTES ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🛒 Ingredientes</Text>
            <TextInput
              style={styles.input}
              value={busqueda}
              onChangeText={(t) => {
                setBusqueda(t);
                setShowCatalogo(true);
              }}
              onFocus={() => setShowCatalogo(true)}
              placeholder="Buscar ingrediente..."
              placeholderTextColor="#94a3b8"
            />
            {showCatalogo && busqueda.length > 0 && (
              <View style={styles.dropdown}>
                {filteredCatalogo.slice(0, 6).map((ing) => (
                  <TouchableOpacity
                    key={ing.id}
                    style={styles.dropdownItem}
                    onPress={() => handleAddIngrediente(ing)}
                  >
                    <Text style={styles.dropdownText}>{ing.nombre}</Text>
                    <Text style={styles.dropdownUnit}>{ing.unidad_base}</Text>
                  </TouchableOpacity>
                ))}
                {filteredCatalogo.length === 0 && (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      { backgroundColor: "#EFF6FF" },
                    ]}
                    onPress={openCreateIng}
                  >
                    <Text style={[styles.dropdownText, { color: "#1B4F72" }]}>
                      + Crear "{busqueda}"
                    </Text>
                    <Text style={styles.dropdownUnit}>nuevo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {ingredientes.map((ing) => (
              <View key={ing.ingrediente_id} style={styles.ingredienteRow}>
                <Text style={styles.ingredienteNombre} numberOfLines={1}>
                  {ing.nombre}
                </Text>
                <TextInput
                  style={styles.cantidadInput}
                  value={ing.cantidad}
                  onChangeText={(v) =>
                    handleCantidadChange(ing.ingrediente_id, v)
                  }
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
                <Text style={styles.ingredienteUnidad}>{ing.unidad}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveIngrediente(ing.ingrediente_id)}
                >
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {ingredientes.length === 0 && (
              <Text style={styles.emptyHint}>
                Busca y agrega ingredientes arriba
              </Text>
            )}
          </View>

          {/* ── PREPARACIÓN ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Preparación</Text>
            <Text style={styles.fieldHint}>
              Escribe cada paso en una línea separada
            </Text>
            <TextInput
              style={[styles.input, { height: 160, marginTop: 8 }]}
              value={instrucciones}
              onChangeText={setInstrucciones}
              placeholder={
                "Paso 1: Picar las cebollas\nPaso 2: Sofreír en aceite"
              }
              placeholderTextColor="#94a3b8"
              multiline
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditing ? "✓ Guardar cambios" : "✓ Guardar receta"}
              </Text>
            )}
          </Pressable>
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

        {/* Success */}
        <Modal
          visible={showSuccessModal}
          animationType="fade"
          transparent
          onRequestClose={() => {
            setShowSuccessModal(false);
            router.back();
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>
                ✅ {isEditing ? "Receta actualizada" : "Receta creada"}
              </Text>
              <Text style={styles.modalMsg}>{successMsg}</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.back();
                }}
              >
                <Text style={styles.modalBtnText}>OK</Text>
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
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>¿Eliminar receta?</Text>
              <Text style={styles.modalMsg}>
                "{nombre}" será eliminada permanentemente.
              </Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#DC2626" }]}
                onPress={handleDelete}
              >
                <Text style={styles.modalBtnText}>Eliminar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: "#e2e8f0", marginTop: 8 },
                ]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: "#1e293b" }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Crear ingrediente */}
        <Modal
          visible={showCreateIngModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreateIngModal(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateIngModal(false)}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Nuevo ingrediente</Text>
              <TouchableOpacity onPress={handleCreateIngrediente}>
                <Text style={styles.modalSave}>Crear</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={[styles.input, { marginBottom: 16 }]}
                value={newIngNombre}
                onChangeText={setNewIngNombre}
                placeholder="Nombre del ingrediente"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.fieldLabel}>Unidad base</Text>
              <View style={styles.chipRow}>
                {["g", "kg", "ml", "l", "unidades", "tazas", "cucharadas"].map(
                  (u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.chip,
                        newIngUnidad === u && styles.chipActive,
                      ]}
                      onPress={() => setNewIngUnidad(u)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newIngUnidad === u && styles.chipTextActive,
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            </View>
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
  backText: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 8 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  deleteText: { color: "#fca5a5", fontSize: 14, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 100 },
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
  field: { marginBottom: 14 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  fieldHint: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Photo
  fotoContainer: { gap: 10 },
  fotoPreview: { width: "100%", height: 200, borderRadius: 12 },
  fotoActions: { flexDirection: "row", gap: 10 },
  fotoBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  fotoBtnDanger: { borderColor: "#fca5a5" },
  fotoBtnText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  fotoPlaceholder: {
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fotoPlaceholderIcon: { fontSize: 36 },
  fotoPlaceholderText: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },

  // Tiempos
  tiemposRow: { flexDirection: "row", gap: 12 },
  tiempoField: { flex: 1 },
  tiempoTotal: {
    fontSize: 13,
    color: "#1B4F72",
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },

  // Scaler
  scalerRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  scalerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1B4F72",
    alignItems: "center",
    justifyContent: "center",
  },
  scalerBtnText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 26,
  },
  scalerNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1B4F72",
    minWidth: 40,
    textAlign: "center",
  },

  // Chips
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
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  tagChipActive: { borderColor: "#1B4F72", backgroundColor: "#1B4F72" },
  tagChipText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  tagChipTextActive: { color: "#fff" },

  // Keywords
  kwInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  kwAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1B4F72",
    alignItems: "center",
    justifyContent: "center",
  },
  kwAddBtnText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 28,
  },
  kwTag: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  kwTagText: { fontSize: 12, color: "#1B4F72", fontWeight: "600" },

  // Ingredientes
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
  ingredienteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  ingredienteNombre: {
    flex: 1,
    fontSize: 13,
    color: "#1e293b",
    fontWeight: "500",
  },
  cantidadInput: {
    width: 60,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    color: "#1e293b",
    textAlign: "center",
  },
  ingredienteUnidad: { fontSize: 12, color: "#64748b", width: 40 },
  removeBtn: { fontSize: 16, color: "#ef4444", paddingHorizontal: 4 },
  emptyHint: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },

  // Footer
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
  saveButton: {
    backgroundColor: "#1B4F72",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#94a3b8" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },

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
});
