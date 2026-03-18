import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://bvssearzqexlfwjdlnyx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2c3NlYXJ6cWV4bGZ3amRsbnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODU2OTMsImV4cCI6MjA4OTM2MTY5M30.dHqIo0E2XSTQVuoQ5j1VbBVqRqT35-hwoZE5QgkHP4E";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth
export async function signUp(email, password, username = "") {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });
    return { data, error };
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// Scans (History)
export async function saveScan(scanData) {
    const user = await getUser();
    if (!user) return { error: "Not logged in" };

    const { data, error } = await supabase.from("scans").insert({
        user_id: user.id,
        filename: scanData.filename,
        file_size: scanData.fileSize,
        ext: scanData.ext,
        score: scanData.score,
        verdict: scanData.verdict,
        exif_flags: scanData.exif_flags,
        exif_values: scanData.exif_values || {},
        sha256: scanData.sha256,
        meta_integrity: scanData.metaIntegrity,
        compression_anomaly: scanData.compressionAnomaly,
        reasoning: scanData.reasoning || "",
        analyzed_at: scanData.analyzedAt
    });
    return { data, error };
}

export async function getScans() {
    const user = await getUser();
    if (!user) return { data: [], error: "Not logged in" };

    const { data, error } = await supabase
        .from("scans")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    return { data: data || [], error };
}

export async function deleteScan(id) {
    const { error } = await supabase.from("scans").delete().eq("id", id);
    return { error };
}

export async function clearAllScans() {
    const user = await getUser();
    if (!user) return { error: "Not logged in" };
    const { error } = await supabase.from("scans").delete().eq("user_id", user.id);
    return { error };
}

// Cases
export async function createCase(name, notes = "") {
    const user = await getUser();
    if (!user) return { error: "Not logged in" };

    const now = new Date().toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
    }) + " " + new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit"
    });

    const { data, error } = await supabase.from("cases").insert({
        user_id: user.id,
        name,
        notes,
        created_at: now
    }).select().single();
    return { data, error };
}

export async function getCases() {
    const user = await getUser();
    if (!user) return { data: [], error: "Not logged in" };

    const { data, error } = await supabase
        .from("cases")
        .select("*, case_scans(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
    return { data: data || [], error };
}

export async function deleteCase(id) {
    const { error } = await supabase.from("cases").delete().eq("id", id);
    return { error };
}

// Case Scans
export async function addScanToCase(caseId, scanData) {
    const user = await getUser();
    if (!user) return { error: "Not logged in" };

    const { data, error } = await supabase.from("case_scans").insert({
        case_id: caseId,
        user_id: user.id,
        filename: scanData.filename,
        file_size: scanData.fileSize,
        ext: scanData.ext,
        score: scanData.score,
        verdict: scanData.verdict,
        exif_flags: scanData.exif_flags,
        exif_values: scanData.exif_values || {},
        sha256: scanData.sha256,
        meta_integrity: scanData.metaIntegrity,
        compression_anomaly: scanData.compressionAnomaly,
        reasoning: scanData.reasoning || "",
        notes: scanData.notes || "",
        thumbnail: scanData.thumbnail || "",
        analyzed_at: scanData.analyzedAt
    });
    return { data, error };
}

export async function getCaseScans(caseId) {
    const { data, error } = await supabase
        .from("case_scans")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });
    return { data: data || [], error };
}