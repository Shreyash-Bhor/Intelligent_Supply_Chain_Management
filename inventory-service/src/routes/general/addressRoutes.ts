import { Router } from "express";
import { createAddress, deleteAddress, listAddresses, setDefaultAddress, updateAddress } from "../../controllers/general/addressController";
const router = Router();
router.get("/", listAddresses);
router.post("/", createAddress);
router.put("/:addressId", updateAddress);
router.put("/:addressId/default", setDefaultAddress);
router.delete("/:addressId", deleteAddress);
export default router;
