import { env } from "./config/env.js";
import { isFirebaseReady } from "./config/firebase.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(
    `POS Bus Admin API listening on http://localhost:${env.PORT} (${isFirebaseReady ? "firebase" : "demo fallback"})`
  );
});
