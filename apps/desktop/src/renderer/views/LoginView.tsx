import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FcGoogle } from "react-icons/fc";
import { openExternalUrl } from "../commands/appCommands";
import { authStore } from "../store/authStore";

const DEFAULT_GOOGLE_LOGIN_URL = "http://127.0.0.1:8787/auth/google";

/** Renders one pre-authentication entry screen with Google sign-in action. */
export function LoginView() {
  const { t } = useTranslation();
  const setAuthenticated = authStore((state) => state.setAuthenticated);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      const googleLoginUrl = import.meta.env.VITE_AUTH_GOOGLE_START_URL || DEFAULT_GOOGLE_LOGIN_URL;
      const openResult = await openExternalUrl(googleLoginUrl);

      if (!openResult.opened) {
        setErrorMessage(t("auth.login.errors.openGoogleFailed"));
        return;
      }

      setAuthenticated(true);
    } catch {
      setErrorMessage(t("auth.login.errors.unexpected"));
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
      }}
    >
      <Stack
        spacing={2.5}
        sx={{
          width: "100%",
          maxWidth: 460,
          textAlign: "center",
        }}
      >
        <Stack spacing={1}>
          <Typography variant="h4" fontWeight={700}>
            {t("auth.login.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("auth.login.description")}
          </Typography>
        </Stack>

        {errorMessage ? (
          <Alert severity="error" role="alert">
            {errorMessage}
          </Alert>
        ) : null}

        <Button
          variant="contained"
          size="large"
          onClick={() => {
            void handleGoogleSignIn();
          }}
          disabled={isSigningIn}
          startIcon={isSigningIn ? <CircularProgress size={18} color="inherit" /> : <FcGoogle size={20} />}
        >
          {isSigningIn ? t("auth.login.signingIn") : t("auth.login.googleCta")}
        </Button>
      </Stack>
    </Box>
  );
}
