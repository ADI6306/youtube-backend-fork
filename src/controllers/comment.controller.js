import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { page = 1, limit = 10 } = req.query

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    const parsedPage = Math.max(Number(page), 1)
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 20)
    const skip = (parsedPage - 1) * parsedLimit

    const comments = await Comment.find({ video: videoId })
        .populate("owner", "username fullName avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)

    const totalComments = await Comment.countDocuments({ video: videoId })

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                comments,
                page: parsedPage,
                limit: parsedLimit,
                totalComments,
            },
            "Comments fetched successfully"
        )
    )
})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id")
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required")
    }

    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user._id,
    })

    const createdComment = await Comment.findById(comment._id).populate(
        "owner",
        "username fullName avatar"
    )

    return res.status(201).json(
        new ApiResponse(201, createdComment, "Comment added successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Comment content is required")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to update this comment")
    }

    comment.content = content.trim()
    await comment.save({ validateBeforeSave: true })

    const updatedComment = await Comment.findById(comment._id).populate(
        "owner",
        "username fullName avatar"
    )

    return res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    )
})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this comment")
    }

    await Comment.findByIdAndDelete(commentId)

    return res.status(200).json(
        new ApiResponse(200, { commentId }, "Comment deleted successfully")
    )
})

export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment,
}
