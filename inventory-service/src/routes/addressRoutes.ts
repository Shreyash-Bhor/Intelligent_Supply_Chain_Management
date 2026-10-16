import { Router } from "express";
import { createAddress, deleteAddress, listAddresses, updateAddress } from "../controllers/addressController";
const router = Router();
router.get("/", listAddresses);
router.post("/", createAddress);
router.put("/:addressId", updateAddress);
router.delete("/:addressId", deleteAddress);
export default router;
