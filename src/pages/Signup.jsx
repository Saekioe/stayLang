import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Divider, Link, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

// MUI X Date Pickers imports
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { useAuth, authMessage, signInWithGoogle } from "../auth/Auth";
import { Field, AuthCard, GoogleButton } from "../components/Authui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export default function Signup() {
  const navigate = useNavigate();
  const { setProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirm: "",
    firstName: "",
    lastName: "",
    username: "",
    birthday: null,
    phone: "",
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Step 1: credentials
  const handleNext = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(form.email.trim()))
      return setError("Enter a valid email address.");
    if (form.password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    setError("");
    setStep(2);
  };

  const handleGoogle = async () => {
    setError("");
    setBusy(true);
    const result = await signInWithGoogle();
    if (result.error) {
      setBusy(false);
      return setError(result.error);
    }
    if (result.cancelled) return setBusy(false);
    if (result.profile) setProfile(result.profile);
    navigate(result.isAdmin ? "/admin/dashboard" : "/");
  };

  // Step 2: profile, then create everything
  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();

    if (!form.firstName.trim() || !form.lastName.trim())
      return setError("Enter your first and last name.");
    if (!USERNAME_RE.test(username))
      return setError(
        'Username must be 3–20 characters: letters, numbers, "_" or ".".',
      );
    if (!form.birthday || !form.birthday.isValid())
      return setError("Enter a valid birthday.");
    if (form.birthday.isAfter(dayjs()))
      return setError("Your birthday can't be in the future.");
    if (form.phone.replace(/\D/g, "").length < 10)
      return setError("Enter a valid phone number.");

    setError("");
    setBusy(true);

    try {
      // Quick pre-check so we don't create an account for a taken username.
      // If it can't be read while signed out, skip it: the transaction below
      // is the real check and cleans up the new account if the name is taken.
      const taken = await getDoc(doc(db, "usernames", username))
        .then((snap) => snap.exists())
        .catch(() => false);
      if (taken) {
        setBusy(false);
        return setError("That username is already taken.");
      }

      // Firebase Auth enforces unique emails and throws if it's already used.
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, form.password);
      } catch (err) {
        setBusy(false);
        if (
          err.code === "auth/email-already-in-use" ||
          err.code === "auth/invalid-email"
        )
          setStep(1);
        return setError(authMessage(err.code));
      }

      const profile = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username,
        birthday: form.birthday.format("YYYY-MM-DD"),
        phone: form.phone.trim(),
        email,
      };

      try {
        // Transaction guards against two people claiming a username at once.
        await runTransaction(db, async (tx) => {
          const nameRef = doc(db, "usernames", username);
          if ((await tx.get(nameRef)).exists())
            throw new Error("username-taken");
          tx.set(nameRef, { uid: cred.user.uid, email });
          tx.set(doc(db, "users", cred.user.uid), {
            ...profile,
            createdAt: serverTimestamp(),
          });
        });
      } catch (err) {
        await deleteUser(cred.user).catch(() => {});
        setBusy(false);
        return setError(
          err.message === "username-taken"
            ? "That username is already taken."
            : "Could not save your profile. Please try again.",
        );
      }

      await updateProfile(cred.user, { displayName: profile.firstName }).catch(
        () => {},
      );
      setProfile(profile);
      navigate("/");
    } catch (err) {
      setBusy(false);
      setError(authMessage(err.code));
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <AuthCard title="Signup" subtitle={`Step ${step} of 2`}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {error}
          </Alert>
        )}

        {step === 1 ? (
          <Box component="form" onSubmit={handleNext} noValidate>
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              autoFocus
            />
            <Field
              label="Password"
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
            />
            <Field
              label="Confirm Password"
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
            />
            <Button
              type="submit"
              variant="contained"
              disableElevation
              disabled={busy}
              endIcon={<ArrowForwardIcon />}
              sx={{
                display: "flex",
                mx: "auto",
                mt: 2,
                borderRadius: "8px",
                px: 4,
              }}
            >
              Next
            </Button>

            <Divider sx={{ my: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Or
              </Typography>
            </Divider>
            <GoogleButton onClick={handleGoogle} disabled={busy}>
              Sign up with Google
            </GoogleButton>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <Field
                label="First name"
                value={form.firstName}
                onChange={set("firstName")}
                autoComplete="given-name"
                autoFocus
              />
              <Field
                label="Last name"
                value={form.lastName}
                onChange={set("lastName")}
                autoComplete="family-name"
              />
            </Box>
            <Field
              label="Username"
              value={form.username}
              onChange={set("username")}
              autoComplete="username"
            />

            <Box sx={{ mt: 2, mb: 1 }}>
              <DatePicker
                label="Birthday"
                value={form.birthday}
                onChange={(newValue) =>
                  setForm((f) => ({ ...f, birthday: newValue }))
                }
                maxDate={dayjs()}
                slotProps={{
                  textField: { size: "small", fullWidth: true },
                }}
              />
            </Box>

            <Field
              label="Phone number"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              autoComplete="tel"
            />
            <Box
              sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 2 }}
            >
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                disabled={busy}
                color="inherit"
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                disableElevation
                disabled={busy}
                sx={{ borderRadius: "8px", px: 3 }}
              >
                {busy ? "Creating…" : "Create account"}
              </Button>
            </Box>
          </Box>
        )}

        <Typography variant="body2" sx={{ textAlign: "center", mt: 3 }}>
          Already have an account?{" "}
          <Link component={RouterLink} to="/login" underline="hover">
            Login
          </Link>
        </Typography>
      </AuthCard>
    </LocalizationProvider>
  );
}
