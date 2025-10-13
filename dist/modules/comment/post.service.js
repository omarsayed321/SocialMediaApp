"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postService = exports.postAvailability = void 0;
const user_repository_1 = require("../../DB/repository/user.repository");
const User_model_1 = require("../../DB/model/User.model");
const post_repository_1 = require("../../DB/repository/post.repository");
const Post_model_1 = require("../../DB/model/Post.model");
const success_response_1 = require("../../utils/response/success.response");
const error_response_1 = require("../../utils/response/error.response");
const s3_config_1 = require("../../utils/multer/s3.config");
const uuid_1 = require("uuid");
const mongoose_1 = require("mongoose");
const cloud_multer_js_1 = require("../../utils/multer/cloud.multer.js");
const postAvailability = (req) => {
    return [
        { availability: Post_model_1.AvailabilityEnum.public },
        {
            availability: Post_model_1.AvailabilityEnum.onlyMe,
            createdBy: req.user?._id,
        },
        {
            availability: Post_model_1.AvailabilityEnum.friends,
            createdBy: { $in: [...(req.user?.friends || []), req.user?._id] },
        },
        {
            availability: { $ne: Post_model_1.AvailabilityEnum.onlyMe },
            tags: { $in: req.user?._id },
        },
    ];
};
exports.postAvailability = postAvailability;
class PostService {
    userModel = new user_repository_1.UserRepository(User_model_1.UserModel);
    postModel = new post_repository_1.PostRepository(Post_model_1.PostModel);
    constructor() { }
    postList = async (req, res) => {
        let { page, size } = req.query;
        const posts = await this.postModel.paginate({
            filter: {
                $or: (0, exports.postAvailability)(req),
            },
            page,
            size,
        });
        return (0, success_response_1.successResponse)({ res, data: { posts } });
    };
    likePost = async (req, res) => {
        const { postId } = req.params;
        const { action } = req.query;
        let update = {
            $addToSet: { likes: req.user?._id },
        };
        if (action === Post_model_1.LikeActionEnum.unlike) {
            update = { $pull: { likes: req.user?._id } };
        }
        const post = await this.postModel.findOneAndUpdate({
            filter: {
                _id: postId,
                $or: (0, exports.postAvailability)(req),
            },
            update,
        });
        if (!post) {
            throw new error_response_1.NotFoundException("post not found");
        }
        return (0, success_response_1.successResponse)({ res });
    };
    createPost = async (req, res) => {
        if (req.body.tags?.length &&
            (await this.userModel.find({ filter: { _id: { $in: req.body.tags } } }))
                .length !== req.body.tags.length) {
            throw new error_response_1.NotFoundException("one or more tagged users not found");
        }
        let attachments = [];
        let assetsFolderId = (0, uuid_1.v4)();
        if (req.files?.length) {
            attachments = await (0, s3_config_1.uploadFiles)({
                storageApproach: cloud_multer_js_1.StorageEnum.memory,
                files: req.files,
                path: `users/${req.user?._id}/posy/${assetsFolderId}`,
            });
        }
        const [post] = (await this.postModel.create({
            data: [
                {
                    ...req.body,
                    attachments,
                    assetsFolderId,
                    createdBy: req.user?._id,
                },
            ],
        })) || [];
        if (!post) {
            if (attachments.length) {
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("failed to create post");
        }
        return (0, success_response_1.successResponse)({ res, statusCode: 201 });
    };
    updatePost = async (req, res) => {
        const { postId } = req.params;
        const post = await this.postModel.findOne({
            filter: {
                _id: postId,
                createdBy: req.user?._id,
            },
        });
        if (!post) {
            throw new error_response_1.NotFoundException("post not found");
        }
        if (req.body.tags?.length &&
            (await this.userModel.find({ filter: {
                    _id: { $in: req.body.tags, $ne: req.user?._id }
                } })).length !== req.body.tags.length) {
            throw new error_response_1.NotFoundException("one or more tagged users not found");
        }
        let attachments = [];
        if (req.files?.length) {
            attachments = await (0, s3_config_1.uploadFiles)({
                storageApproach: cloud_multer_js_1.StorageEnum.memory,
                path: `users/${post.createdBy}/post/${post.assetsFolderId}`,
                files: req.files,
            });
        }
        const updatedPost = await this.postModel.updateOne({
            filter: { _id: post._id },
            update: [
                {
                    $set: {
                        content: req.body.content,
                        allowComments: req.body.allowComments || post.allowComments,
                        availability: req.body.availability || post.availability,
                        attachments: {
                            $setUnion: [
                                {
                                    $setDifference: [
                                        "$attachments",
                                        req.body.removedAttachments || [],
                                    ],
                                },
                                attachments,
                            ],
                        },
                        tags: {
                            $setUnion: [
                                {
                                    $setDifference: [
                                        "$tags",
                                        (req.body.removedTags || []).map((tag) => {
                                            return mongoose_1.Types.ObjectId.createFromHexString(tag);
                                        }),
                                    ],
                                },
                                (req.body.tags || []).map((tag) => {
                                    return mongoose_1.Types.ObjectId.createFromHexString(tag);
                                }),
                            ],
                        },
                    },
                },
            ],
        });
        if (!updatedPost.matchedCount) {
            if (attachments.length) {
                await (0, s3_config_1.deleteFiles)({ urls: attachments });
            }
            throw new error_response_1.BadRequestException("failed to update post");
        }
        else {
            if (req.body.removedAttachments?.length) {
                await (0, s3_config_1.deleteFiles)({ urls: req.body.removedAttachments });
            }
        }
        return (0, success_response_1.successResponse)({ res });
    };
}
exports.postService = new PostService();
