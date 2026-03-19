# Null!fy — Forensic AI Image Detection

**Live demo:** [nullify-gamma.vercel.app](https://nullify-gamma.vercel.app)

---

## Inspiration

We kept seeing news about deepfakes being used to spread misinformation — fabricated crime scene photos, AI-generated "evidence," viral images that turned out to be completely fake. And every time we looked for a tool that could actually help someone verify an image quickly, we came up empty. The tools that exist are either buried in research papers or cost money most people don't have. We figured if this is already a problem now, it's going to be a much bigger one soon — especially for investigators and journalists who need to make decisions based on what they're looking at. So we built something.

## What It Does

You upload an image, and Null!fy tells you whether it's real or AI-generated. Not just a score, it gives you a full breakdown: a probability percentage, a verdict (Real / Likely AI / Definitely AI), and an actual written explanation of why it flagged the image the way it did. It also pulls EXIF metadata from the file and highlights anything suspicious — missing camera info, inconsistent timestamps, that kind of thing. On top of that it runs a compression anomaly check, calculates a SHA-256 hash for the file, and gives you a metadata integrity score. Everything can be exported as a PDF report. We also built a case management system so investigators can organize scans into named folders, filter by verdict, and pull up their full scan history from any device. Auth and storage are handled by Supabase so nothing gets lost between sessions.

## How We Built It

Frontend is vanilla HTML, CSS, and JS — no framework, just kept it simple and deployed it on Vercel. The backend is FastAPI running on HuggingFace Spaces inside a Docker container. We're hitting the `umm-maybe/AI-image-detector` model through the HuggingFace Inference API for the core detection. EXIF extraction happens server-side with Pillow. SHA-256 hashing runs entirely in the browser using crypto.subtle so the image never has to make an extra trip. PDF export is handled client-side with jsPDF. Supabase takes care of auth and storing scan history and cases in PostgreSQL.

## Challenges We Ran Into

The HuggingFace Inference API has cold starts, and under hackathon pressure that was stressful to deal with. We had to build proper error handling and retry logic so the whole thing didn't just break silently when the model took too long to wake up. Managing Supabase auth state across multiple pages in vanilla JS was also messier than expected — no framework means no context, so we were manually syncing session state and running into weird race conditions on page load. EXIF data was another one — a lot of AI-generated images have zero metadata at all, which is actually useful forensic information, but we had to make sure the app handled that gracefully instead of just crashing or showing empty fields.

## Accomplishments We're Proud Of

Honestly just shipping something that actually works end-to-end in a little over a week. The multi-signal approach — ML score + EXIF analysis + compression anomaly + SHA-256 fingerprint — means the verdict isn't just one model's opinion, it's backed by several independent checks. That makes it a lot more credible than a single confidence score. Getting persistent case management working on top of everything else, with cross-device access, felt like we actually built a product rather than just a hackathon demo.

## What We Learned

Plugging a hosted ML model into a real app is a completely different experience from using one in a notebook. Cold starts, rate limits, unexpected response shapes — you deal with none of that when you're just experimenting locally. We also learned that for something like forensic image analysis, just showing a number isn't enough. People need to understand why the tool thinks what it thinks, which is what pushed us to invest time in the forensic reasoning summary instead of just slapping a percentage on the screen.

## What's Next for Null!fy

- Real GradCAM heatmap pulled from model internals instead of the visual approximation we have now
- Video and deepfake detection for CCTV footage
- Role-based access for investigation teams

---
