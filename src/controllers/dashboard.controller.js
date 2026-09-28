import mongoose from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user._id

    const videoStats = await Video.aggregate([
        { $match: { owner: userId } },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" },
                videoIds: { $push: "$_id" },
            },
        },
    ])

    const channelStat = videoStats[0] || { totalVideos: 0, totalViews: 0, videoIds: [] }

    const totalSubscribers = await Subscription.countDocuments({ channel: userId })

    const totalLikes = await Like.aggregate([
        {
            $match: {
                video: { $in: channelStat.videoIds },
            },
        },
        { $count: "totalLikes" },
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalVideos: channelStat.totalVideos,
                totalViews: channelStat.totalViews,
                totalSubscribers,
                totalLikes: totalLikes[0]?.totalLikes || 0,
            },
            "Channel stats fetched successfully"
        )
    )
})

const getChannelVideos = asyncHandler(async (req, res) => {
    const videos = await Video.aggregate([
        { $match: { owner: req.user._id } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { $project: { fullName: 1, username: 1, avatar: 1 } },
                ],
            },
        },
        { $addFields: { owner: { $first: "$owner" } } },
        { $sort: { createdAt: -1 } },
    ])

    return res.status(200).json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
    )
})

export {
    getChannelStats,
    getChannelVideos,
}