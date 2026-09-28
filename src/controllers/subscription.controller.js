import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }

    if (channelId === req.user._id.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel")
    }

    const existingSubscription = await Subscription.findOne({
        subscriber: req.user._id,
        channel: channelId,
    })

    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id)
        return res.status(200).json(
            new ApiResponse(200, { subscribed: false }, "Subscription removed")
        )
    }

    const subscription = await Subscription.create({
        subscriber: req.user._id,
        channel: channelId,
    })

    return res.status(200).json(
        new ApiResponse(200, { subscribed: true, subscription }, "Subscribed successfully")
    )
})

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id")
    }

    const subscribers = await Subscription.find({ channel: channelId })
        .populate("subscriber", "username fullName avatar")
        .sort({ createdAt: -1 })

    return res.status(200).json(
        new ApiResponse(200, subscribers, "Channel subscribers fetched successfully")
    )
})

const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber id")
    }

    const subscriptions = await Subscription.find({ subscriber: subscriberId })
        .populate("channel", "username fullName avatar")
        .sort({ createdAt: -1 })

    return res.status(200).json(
        new ApiResponse(200, subscriptions, "Subscribed channels fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels,
}