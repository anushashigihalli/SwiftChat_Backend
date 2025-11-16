import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Get all users except current user
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("_id fullName profilePic");

    // Get last message and unread count for each user
    const usersWithLastMessage = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
          isDeleted: { $ne: true },
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          status: { $ne: "read" },
          isDeleted: { $ne: true },
        });

        return {
          ...user.toObject(),
          lastMessage: lastMessage ? {
            text: lastMessage.text,
            image: lastMessage.image,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          } : null,
          unreadCount,
        };
      })
    );

    // Sort users by last message time (most recent first)
    const sortedUsers = usersWithLastMessage.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.status(200).json(sortedUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      isDeleted: { $ne: true },
    }).sort({ createdAt: 1 });

    // Mark received messages as delivered
    await Message.updateMany(
      {
        senderId: userToChatId,
        receiverId: myId,
        status: "sent",
      },
      { status: "delivered" }
    );

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    let messageType = "text";
    if (image) {
      // For demo purposes, save base64 directly instead of uploading to Cloudinary
      imageUrl = image;
      messageType = "image";
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      messageType,
      replyTo: req.body.replyTo,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user._id;

    await Message.updateMany(
      {
        senderId,
        receiverId,
        status: { $ne: "read" },
      },
      { status: "read" }
    );

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.log("Error in markMessagesAsRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    await Message.findByIdAndUpdate(messageId, { isDeleted: true });

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.log("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: "Cannot edit deleted message" });
    }

    // Store original text if this is the first edit
    if (!message.isEdited) {
      message.originalText = message.text;
    }

    message.text = text;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in editMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
