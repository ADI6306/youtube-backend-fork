import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query

    const parsedPage = Math.max(Number(page), 1)
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 20)
    const skip = (parsedPage - 1) * parsedLimit

    const match = { isPublished: true }
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user id")
        }
        match.owner = new mongoose.Types.ObjectId(userId)
    }

    if (query?.trim()) {
        match.$or = [
            { title: { $regex: query.trim(), $options: "i" } },
            { description: { $regex: query.trim(), $options: "i" } },
        ]
    }

    const sortOrder = sortType === "asc" ? 1 : -1
    const validSortFields = ["createdAt", "views", "title", "duration"]
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt"

    const pipeline = [
        { $match: match },
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
        { $sort: { [sortField]: sortOrder } },
        { $skip: skip },
        { $limit: parsedLimit },
    ]

    const [videos, totalVideos] = await Promise.all([
        Video.aggregate(pipeline),
        Video.countDocuments(match),
    ])

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos,
                page: parsedPage,
                limit: parsedLimit,
                totalVideos,
            },
            "Videos fetched successfully"
        )
    )
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description, duration } = req.body

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required")
    }

    const videoLocalPath = req.files?.videoFile?.[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required")
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required")
    }

    const uploadedVideo = await uploadOnCloudinary(videoLocalPath)
    const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if (!uploadedVideo || !uploadedThumbnail) {
        throw new ApiError(500, "Video upload failed")
    }

    const video = await Video.create({
        videoFile: uploadedVideo.url,
        thumbnail: uploadedThumbnail.url,
        title: title.trim(),
        description: description.trim(),
        duration: Number(duration) || 0,
        owner: req.user._id,
    })

    const createdVideo = await Video.findById(video._id).populate(
        "owner",
        "username fullName avatar"
    )

    return res.status(201).json(
        new ApiResponse(201, createdVideo, "Video published successfully")
    )
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId).populate(
        "owner",
        "username fullName avatar"
    )

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    )
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to update this video")
    }

    if (title !== undefined && title?.trim()) {
        video.title = title.trim()
    }

    if (description !== undefined && description?.trim()) {
        video.description = description.trim()
    }

    const thumbnailLocalPath = req.file?.path
    if (thumbnailLocalPath) {
        const uploadedThumbnail = await uploadOnCloudinary(thumbnailLocalPath)
        if (!uploadedThumbnail) {
            throw new ApiError(500, "Thumbnail upload failed")
        }
        video.thumbnail = uploadedThumbnail.url
    }

    await video.save()

    const updatedVideo = await Video.findById(videoId).populate(
        "owner",
        "username fullName avatar"
    )

    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video updated successfully")
    )
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this video")
    }

    await Video.findByIdAndDelete(videoId)

    return res.status(200).json(
        new ApiResponse(200, { videoId }, "Video deleted successfully")
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to update this video")
    }

    video.isPublished = !video.isPublished
    await video.save()

    return res.status(200).json(
        new ApiResponse(
            200,
            { videoId, isPublished: video.isPublished },
            `Video ${video.isPublished ? "published" : "unpublished"} successfully`
        )
    )
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
}
