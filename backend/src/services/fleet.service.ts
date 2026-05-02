import { extractFleet } from "./dataTransform.service.js";
import { firebaseService } from "./firebase.service.js";

export const fleetService = {
  async getLiveFleet() {
    const root = await firebaseService.getRootData();
    return extractFleet(root);
  }
};
