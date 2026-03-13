import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { useAuthStore } from "../../src/store/useAuthStore";
import { useTripStore } from "../../src/store/useTripStore";

const VERSION = "0.1.0";

// ─────────────────────────────────────────────
// Static content
// ─────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Crea un paseo",
    desc: "Define fechas, lugar y comparte el código de invitación con tu grupo.",
  },
  {
    step: "02",
    title: "Arma el menú",
    desc: "Elige recetas del catálogo compartido para cada día del paseo.",
  },
  {
    step: "03",
    title: "Registra los gastos",
    desc: "Anota quién pagó qué. La app divide todo automáticamente.",
  },
  {
    step: "04",
    title: "Liquida con un toque",
    desc: "Calcula transferencias mínimas para cuadrar cuentas al final.",
  },
];

const TESTIMONIOS = [
  {
    nombre: "Camila R.",
    texto: "Pasamos de planillas de Excel a PaseoApp. La diferencia es brutal.",
    emoji: "🏕️",
  },
  {
    nombre: "Andrés M.",
    texto: "Por fin algo que entiende que hay niños con factor distinto.",
    emoji: "👨‍👩‍👧‍👦",
  },
  {
    nombre: "Laura P.",
    texto: "El módulo de recetas me salvó. Nunca más improvisamos en el campo.",
    emoji: "🍳",
  },
];

const FAQ = [
  {
    q: "¿Cuántas personas puede tener un paseo?",
    a: "No hay límite. Puedes tener tantos participantes como necesites, organizados por familias.",
  },
  {
    q: "¿Qué pasa si alguien no come en una comida?",
    a: "Puedes desactivarlo para ese momento específico y el costo se redistribuye automáticamente.",
  },
  {
    q: "¿Puedo usar PaseoApp sin internet?",
    a: "Necesitas conexión para sincronizar datos, pero la navegación básica funciona con caché.",
  },
  {
    q: "¿Cómo se calculan las liquidaciones?",
    a: "Usamos el algoritmo de transferencias mínimas para reducir al máximo el número de pagos.",
  },
];

const ESTADO_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  planificacion: { color: "#92400E", bg: "#FEF3C7", label: "Planificación" },
  activo: { color: "#065F46", bg: "#D1FAE5", label: "Activo" },
  liquidado: { color: "#1D4ED8", bg: "#DBEAFE", label: "Liquidado" },
};

const initials = (name: string) =>
  name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "??";

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function HomeScreen() {
  const { persona, signOut, initialize } = useAuthStore();
  const { paseos, fetchPaseos } = useTripStore();
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Profile state ──
  const [fullPersona, setFullPersona] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [restricciones, setRestricciones] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notificaciones, setNotificaciones] = useState(true);

  // ── FAQ state ──
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ── Modals ──
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setShowErrorModal(true);
  };

  // ─────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    if (persona?.id) loadFullPersona();
  }, [persona]);

  useFocusEffect(
    useCallback(() => {
      fetchPaseos();
    }, []),
  );

  const loadFullPersona = async () => {
    if (!persona?.id) return;
    const { data } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona.id)
      .single();
    if (data) {
      setFullPersona(data);
      setNombre(data.nombre ?? "");
      setTelefono(data.telefono ?? "");
      setRestricciones(data.restricciones_alimentarias ?? "");
      setFotoUrl(data.foto_url ?? "");
    }
  };

  const handleSave = async () => {
    if (!fullPersona?.id) {
      showError("No se pudo identificar tu perfil.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("personas")
      .update({
        nombre,
        telefono,
        restricciones_alimentarias: restricciones,
        foto_url: fotoUrl,
      })
      .eq("id", fullPersona.id);
    if (error) showError(error.message);
    else {
      setEditing(false);
      loadFullPersona();
      initialize();
    }
    setSaving(false);
  };

  const pickImage = async (source: "camera" | "gallery") => {
    setShowPhotoModal(false);
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        showError("Necesitamos acceso a tu cámara.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showError("Necesitamos acceso a tu galería.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const fileName = `${persona!.id}.jpg`;
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
      setFotoUrl(publicUrl);
      await supabase
        .from("personas")
        .update({ foto_url: publicUrl })
        .eq("id", persona!.id);
    } catch {
      showError("No se pudo procesar la imagen.");
    }
    setUploadingPhoto(false);
  };

  // ─────────────────────────────────────────────
  // Derived
  // ─────────────────────────────────────────────
  const paseosActivos = paseos.filter((p) => p.estado === "activo");
  const paseosPlanificacion = paseos.filter(
    (p) => p.estado === "planificacion",
  );
  const paseosRecientes = [...paseosActivos, ...paseosPlanificacion].slice(
    0,
    3,
  );

  // ─────────────────────────────────────────────
  // UNAUTHENTICATED view
  // ─────────────────────────────────────────────
  if (!persona) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                🏕️ Para grupos que viajan juntos
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              Planea.{"\n"}Come bien.{"\n"}Cuadra cuentas.
            </Text>
            <Text style={styles.heroSub}>
              PaseoApp organiza el menú, los gastos y las deudas de tu próximo
              paseo — sin hojas de cálculo, sin peleas.
            </Text>
            <TouchableOpacity
              style={styles.heroCTA}
              onPress={() => router.push("/auth")}
            >
              <Text style={styles.heroCTAText}>Comenzar gratis →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/auth")}>
              <Text style={styles.heroSecondary}>
                ¿Ya tienes cuenta? Inicia sesión
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            {[
              ["🏕️", "Paseos"],
              ["🍽️", "Recetas"],
              ["👥", "Familias"],
              ["💸", "Sin drama"],
            ].map(([icon, label], i) => (
              <View key={i} style={styles.stripItem}>
                <Text style={styles.stripIcon}>{icon}</Text>
                <Text style={styles.stripLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Cómo funciona */}
          <View style={styles.howSection}>
            <Text style={styles.sectionHeading}>Cómo funciona</Text>
            {HOW_IT_WORKS.map((item, i) => (
              <View key={i} style={styles.howRow}>
                <View style={styles.howStepBadge}>
                  <Text style={styles.howStepText}>{item.step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.howTitle}>{item.title}</Text>
                  <Text style={styles.howDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Testimonios */}
          <View style={styles.testimoniosSection}>
            <Text style={styles.sectionHeading}>Lo que dicen</Text>
            {TESTIMONIOS.map((t, i) => (
              <View key={i} style={styles.testimonioCard}>
                <Text style={styles.testimonioEmoji}>{t.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testimonioTexto}>"{t.texto}"</Text>
                  <Text style={styles.testimonioNombre}>— {t.nombre}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA final */}
          <View style={styles.ctaFinalSection}>
            <Text style={styles.ctaFinalTitle}>
              ¿Listo para tu próximo paseo?
            </Text>
            <TouchableOpacity
              style={styles.heroCTA}
              onPress={() => router.push("/auth")}
            >
              <Text style={styles.heroCTAText}>Crear cuenta gratis →</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerText}>
            PaseoApp v{VERSION} · Hecho con ❤️ en Colombia
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // AUTHENTICATED view
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PERFIL ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <TouchableOpacity
              onPress={() => setShowPhotoModal(true)}
              style={styles.avatarWrap}
            >
              {uploadingPhoto ? (
                <View style={styles.avatar}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : fotoUrl ? (
                <Image source={{ uri: fotoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initials(nombre || persona?.nombre || "?")}
                  </Text>
                </View>
              )}
              <View style={styles.avatarCam}>
                <Text style={{ fontSize: 10 }}>📷</Text>
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput
                  style={styles.nameInput}
                  value={nombre}
                  onChangeText={setNombre}
                  placeholder="Tu nombre"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              ) : (
                <Text style={styles.profileName}>
                  {nombre || persona?.nombre}
                </Text>
              )}
              <Text style={styles.profileEmail}>
                {fullPersona?.email ?? ""}
              </Text>
              {!editing && fullPersona?.restricciones_alimentarias ? (
                <View style={styles.restriccionesBadge}>
                  <Text style={styles.restriccionesText}>
                    ⚠️ {fullPersona.restricciones_alimentarias}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {editing && (
            <View style={styles.editFields}>
              <TextInput
                style={styles.editInput}
                value={telefono}
                onChangeText={setTelefono}
                placeholder="Teléfono"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.editInput}
                value={restricciones}
                onChangeText={setRestricciones}
                placeholder="Restricciones alimentarias (opcional)"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>
          )}

          <View style={styles.profileActions}>
            {editing ? (
              <>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Guardando..." : "✓ Guardar"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditing(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditing(true)}
              >
                <Text style={styles.editBtnText}>✏️ Editar perfil</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── ACCESOS RÁPIDOS ── */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/trips" as any)}
          >
            <Text style={styles.quickIcon}>🏕️</Text>
            <Text style={styles.quickLabel}>Mis paseos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/recipes" as any)}
          >
            <Text style={styles.quickIcon}>📖</Text>
            <Text style={styles.quickLabel}>Recetas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/grocery" as any)}
          >
            <Text style={styles.quickIcon}>🛒</Text>
            <Text style={styles.quickLabel}>Mercado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push("/expenses" as any)}
          >
            <Text style={styles.quickIcon}>💸</Text>
            <Text style={styles.quickLabel}>Gastos</Text>
          </TouchableOpacity>
        </View>

        {/* ── PASEOS RECIENTES ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Paseos activos</Text>
            <TouchableOpacity onPress={() => router.push("/trips" as any)}>
              <Text style={styles.sectionLink}>Ver todos →</Text>
            </TouchableOpacity>
          </View>

          {paseosRecientes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏕️</Text>
              <Text style={styles.emptyTitle}>Sin paseos aún</Text>
              <Text style={styles.emptySub}>
                Ve a Mis Paseos para crear el primero
              </Text>
            </View>
          ) : (
            paseosRecientes.map((p) => {
              const cfg =
                ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG["planificacion"];
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.paseoRow}
                  onPress={() =>
                    router.push({
                      pathname: "/tripDetail",
                      params: { id: p.id },
                    })
                  }
                >
                  <View style={styles.paseoRowLeft}>
                    {p.foto_url ? (
                      <Image
                        source={{ uri: p.foto_url }}
                        style={styles.paseoThumb}
                      />
                    ) : (
                      <View style={styles.paseoThumbPlaceholder}>
                        <Text style={{ fontSize: 20 }}>🏕️</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paseoNombre} numberOfLines={1}>
                        {p.nombre}
                      </Text>
                      <Text style={styles.paseoFecha}>
                        {p.lugar ?? ""} · {p.fecha_inicio} → {p.fecha_fin}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View
                      style={[styles.estadoBadge, { backgroundColor: cfg.bg }]}
                    >
                      <Text style={[styles.estadoText, { color: cfg.color }]}>
                        {cfg.label}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── ACTIVIDAD RECIENTE (stats) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.statsRow}>
            {[
              { val: paseos.length, label: "Paseos", color: "#1B4F72" },
              { val: paseosActivos.length, label: "Activos", color: "#065F46" },
              {
                val: paseosPlanificacion.length,
                label: "Planeando",
                color: "#B45309",
              },
              {
                val: paseos.filter((p) => p.estado === "liquidado").length,
                label: "Liquidados",
                color: "#6D28D9",
              },
            ].map((s, i) => (
              <View
                key={i}
                style={[styles.statBox, i > 0 && styles.statBoxBorder]}
              >
                <Text style={[styles.statVal, { color: s.color }]}>
                  {s.val}
                </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CONFIGURACIÓN ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🔔</Text>
              <View>
                <Text style={styles.settingLabel}>Notificaciones</Text>
                <Text style={styles.settingSub}>Gastos y cambios al menú</Text>
              </View>
            </View>
            <Switch
              value={notificaciones}
              onValueChange={setNotificaciones}
              trackColor={{ false: "#e2e8f0", true: "#1B4F72" }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>🌍</Text>
              <View>
                <Text style={styles.settingLabel}>Idioma</Text>
                <Text style={styles.settingSub}>Español</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </View>
        </View>

        {/* ── FAQ ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preguntas frecuentes</Text>
          {FAQ.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.faqItem,
                i === FAQ.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => setOpenFaq(openFaq === i ? null : i)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqChevron}>
                  {openFaq === i ? "↑" : "↓"}
                </Text>
              </View>
              {openFaq === i && <Text style={styles.faqA}>{item.a}</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CERRAR SESIÓN ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowSignOutModal(true)}
        >
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          PaseoApp v{VERSION} · Hecho con ❤️ en Colombia
        </Text>
      </Animated.ScrollView>

      {/* ── MODALS ── */}

      {/* Sign out confirm */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Cerrar sesión</Text>
            <Text style={styles.confirmMsg}>
              ¿Estás seguro de que quieres salir?
            </Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#DC2626" }]}
              onPress={() => {
                setShowSignOutModal(false);
                signOut();
              }}
            >
              <Text style={styles.confirmBtnText}>Salir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmCancel}
              onPress={() => setShowSignOutModal(false)}
            >
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Photo source */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheetBox}>
            <Text style={styles.sheetTitle}>Foto de perfil</Text>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => pickImage("camera")}
            >
              <Text style={styles.sheetOptionText}>📷 Tomar foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => pickImage("gallery")}
            >
              <Text style={styles.sheetOptionText}>🖼️ Elegir de galería</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>⚠️ Error</Text>
            <Text style={styles.confirmMsg}>{errorMsg}</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: "#1B4F72" }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.confirmBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, paddingBottom: 48 },

  // ── Unauthenticated ──────────────────────────
  heroSection: { paddingVertical: 32, alignItems: "flex-start" },
  heroBadge: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 20,
  },
  heroBadgeText: { fontSize: 12, fontWeight: "600", color: "#1D4ED8" },
  heroTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 46,
    marginBottom: 16,
    letterSpacing: -1,
  },
  heroSub: { fontSize: 16, color: "#475569", lineHeight: 24, marginBottom: 28 },
  heroCTA: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 14,
  },
  heroCTAText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  heroSecondary: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    alignSelf: "center",
  },

  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  stripItem: { flex: 1, alignItems: "center", gap: 4 },
  stripIcon: { fontSize: 22 },
  stripLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },

  howSection: { marginBottom: 32 },
  sectionHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  howRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  howStepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  howStepText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  howTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  howDesc: { fontSize: 13, color: "#64748b", lineHeight: 18 },

  testimoniosSection: { marginBottom: 32 },
  testimonioCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  testimonioEmoji: { fontSize: 28, flexShrink: 0, marginTop: 2 },
  testimonioTexto: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 20,
    marginBottom: 6,
    fontStyle: "italic",
  },
  testimonioNombre: { fontSize: 12, fontWeight: "700", color: "#94a3b8" },

  ctaFinalSection: { alignItems: "stretch", marginBottom: 32 },
  ctaFinalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
    textAlign: "center",
  },

  // ── Authenticated ────────────────────────────
  profileCard: {
    backgroundColor: "#1B4F72",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  avatarCam: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 2,
  },
  profileEmail: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  restriccionesBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  restriccionesText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  nameInput: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(255,255,255,0.4)",
    paddingBottom: 2,
    marginBottom: 4,
  },
  editFields: { gap: 8, marginBottom: 14 },
  editInput: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 14,
  },
  profileActions: { flexDirection: "row", gap: 8 },
  editBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  saveBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#1B4F72", fontWeight: "800", fontSize: 13 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    fontSize: 13,
  },

  // Quick access
  quickRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickIcon: { fontSize: 24 },
  quickLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },

  // Section
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  sectionLink: { fontSize: 13, color: "#1B4F72", fontWeight: "600" },

  // Paseos
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 6 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  emptySub: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
  paseoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  paseoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  paseoThumb: { width: 42, height: 42, borderRadius: 10 },
  paseoThumbPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  paseoNombre: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  paseoFecha: { fontSize: 11, color: "#94a3b8" },
  estadoBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText: { fontSize: 10, fontWeight: "700" },
  chevron: { fontSize: 18, color: "#cbd5e1" },

  // Stats
  statsRow: { flexDirection: "row" },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 6 },
  statBoxBorder: { borderLeftWidth: 1, borderLeftColor: "#f1f5f9" },
  statVal: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "500" },

  // Settings
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: { fontSize: 20 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  settingSub: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  settingArrow: { fontSize: 20, color: "#cbd5e1" },

  // FAQ
  faqItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQ: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
    paddingRight: 8,
  },
  faqChevron: { fontSize: 14, color: "#94a3b8", fontWeight: "600" },
  faqA: { fontSize: 13, color: "#64748b", lineHeight: 19, marginTop: 8 },

  // Logout
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutText: { fontSize: 14, fontWeight: "600", color: "#64748b" },

  footerText: { textAlign: "center", fontSize: 11, color: "#cbd5e1" },

  // Modals
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "84%",
  },
  confirmTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmMsg: {
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
  confirmCancel: { alignItems: "center", paddingVertical: 4 },
  confirmCancelText: { color: "#64748b", fontSize: 14 },

  sheetBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "84%",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 16,
  },
  sheetOption: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  sheetOptionText: { fontSize: 15, fontWeight: "700", color: "#1B4F72" },
  sheetCancel: { alignItems: "center", marginTop: 4 },
  sheetCancelText: { color: "#64748b", fontSize: 14 },
});
