import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/useAuthStore";

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  // UI states
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setShowErrorModal(true);
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      showError("Por favor completa todos los campos.");
      return;
    }
    if (mode === "signup" && !nombre.trim()) {
      showError("Por favor ingresa tu nombre.");
      return;
    }

    clearError();
    setLoading(true);

    if (mode === "login") {
      const ok = await signIn(email.trim(), password);
      if (ok) {
        router.replace("/(tabs)");
      } else {
        showError(
          error === "Email not confirmed"
            ? "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
            : (error ?? "No se pudo iniciar sesión. Verifica tus datos."),
        );
      }
    } else {
      const result = await signUp(email.trim(), password, nombre.trim());
      if (result === "ok") {
        router.replace("/(tabs)");
      } else if (result === "confirm_email") {
        setShowConfirmScreen(true);
      } else {
        showError(error ?? "No se pudo crear la cuenta.");
      }
    }

    setLoading(false);
  };

  // ── Pantalla de confirmación pendiente ──────────────────────────
  if (showConfirmScreen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.confirmContent}>
          <Text style={styles.confirmEmoji}>📬</Text>
          <Text style={styles.confirmTitle}>Revisa tu correo</Text>
          <Text style={styles.confirmSub}>
            Te enviamos un enlace de confirmación a{"\n"}
            <Text style={styles.confirmEmail}>{email}</Text>
          </Text>
          <Text style={styles.confirmHint}>
            Abre el correo y toca el enlace para activar tu cuenta. Una vez
            confirmado, regresa aquí e inicia sesión.
          </Text>

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => {
              setShowConfirmScreen(false);
              setMode("login");
              setPassword("");
            }}
          >
            <Text style={styles.submitText}>Ir a iniciar sesión →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setShowConfirmScreen(false)}
          >
            <Text style={styles.secondaryBtnText}>Volver</Text>
          </TouchableOpacity>

          <Text style={styles.confirmFooter}>
            ¿No llegó el correo? Revisa la carpeta de spam o vuelve a crear la
            cuenta.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pantalla principal de auth ──────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <Text style={styles.logoEmoji}>🌴</Text>
            <Text style={styles.logoTitle}>PaseoApp</Text>
            <Text style={styles.logoSub}>
              Planifica paseos. Divide gastos.{"\n"}Disfruta sin calcular.
            </Text>
          </View>

          {/* Toggle login / signup */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                mode === "login" && styles.toggleBtnActive,
              ]}
              onPress={() => {
                setMode("login");
                clearError();
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  mode === "login" && styles.toggleTextActive,
                ]}
              >
                Iniciar sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                mode === "signup" && styles.toggleBtnActive,
              ]}
              onPress={() => {
                setMode("signup");
                clearError();
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  mode === "signup" && styles.toggleTextActive,
                ]}
              >
                Crear cuenta
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === "signup" && (
              <View style={styles.field}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre completo"
                  placeholderTextColor="#94a3b8"
                  value={nombre}
                  onChangeText={setNombre}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {mode === "signup" && (
              <View style={styles.confirmNotice}>
                <Text style={styles.confirmNoticeText}>
                  📬 Recibirás un correo para confirmar tu cuenta antes de poder
                  ingresar.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitText}>
                {loading
                  ? "Cargando..."
                  : mode === "login"
                    ? "Entrar"
                    : "Crear cuenta"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>⚠️ Error</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.errorBtn}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.errorBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 24, flexGrow: 1, justifyContent: "center" },

  // Logo
  logoArea: { alignItems: "center", marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 12 },
  logoTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1B4F72",
    marginBottom: 8,
  },
  logoSub: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
  },

  // Toggle
  toggle: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  toggleTextActive: { color: "#1B4F72" },

  // Form
  form: { gap: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1e293b",
  },
  confirmNotice: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  confirmNoticeText: { fontSize: 13, color: "#1D4ED8", lineHeight: 18 },

  submitBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: "#94a3b8" },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  secondaryBtn: { padding: 14, alignItems: "center" },
  secondaryBtnText: { fontSize: 14, color: "#64748b", fontWeight: "600" },

  // Confirm screen
  confirmContent: {
    padding: 32,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmEmoji: { fontSize: 72, marginBottom: 24 },
  confirmTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmSub: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  confirmEmail: { fontWeight: "700", color: "#1B4F72" },
  confirmHint: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
  },
  confirmFooter: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  errorBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "84%",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBtn: {
    backgroundColor: "#1B4F72",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  errorBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
