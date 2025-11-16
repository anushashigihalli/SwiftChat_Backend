import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, markMessagesAsRead, deleteMessage, editMessage } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.put("/read/:id", protectRoute, markMessagesAsRead);
router.put("/edit/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteMessage);

router.post("/send/:id", protectRoute, sendMessage);

export default router;
