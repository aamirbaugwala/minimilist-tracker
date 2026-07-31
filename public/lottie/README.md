# NutriCoach avatar (Lottie)

The voice coach (`app/voice/page.js` → `CoachAvatar`) plays a Lottie animation
from this folder. Until you add one, it shows a soft "AI presence" orb.

## Add your character

1. Go to **https://lottiefiles.com** and find a character you like.
   Good search terms: `AI assistant`, `AI coach`, `chatbot character`,
   `virtual assistant`, `robot assistant`, `talking character`.
   Pick something with an **intelligent / friendly persona** and a clean loop.
2. Download it as **Lottie JSON** (the `.json`, not `.lottie` / `.gif` / `.mp4`).
3. Save the files here with these exact names:

   ```
   public/lottie/coach.json        # REQUIRED — idle / listening / thinking loop
   public/lottie/coach-talk.json   # OPTIONAL — a talking loop, played while speaking
   ```

That's it — reload the app and the coach animates. No code change needed.

## Notes

- If you only add `coach.json`, it's used for every state (the coloured aura +
  thinking dots on top still signal listening / thinking / speaking).
- Add `coach-talk.json` (e.g. a "talking" variant of the same character) to get
  mouth/gesture movement specifically while the coach is speaking.
- Keep files reasonably small (a few hundred KB). Very heavy Lotties can lag on
  phones.
- Prefer a **transparent background** so it sits on the dark voice screen.
- Licensing: use a free/licensed animation (LottieFiles marks free ones), or a
  character you own.

## Want a 3D/Pixar look instead?

Lottie is 2D vector. For a true 3D avatar we'd swap to a `.glb` model + a 3D
renderer — ask and I'll wire that path up instead.
