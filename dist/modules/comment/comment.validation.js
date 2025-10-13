"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyOnComment = exports.createComment = void 0;
const zod_1 = require("zod");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const cloud_multer_1 = require("../../utils/multer/cloud.multer");
exports.createComment = {
    params: zod_1.z.strictObject({ postId: validation_middleware_1.generalFields.id }),
    body: zod_1.z.strictObject({
        content: zod_1.z.string().min(2).max(500000).optional(),
        attachments: zod_1.z.array(validation_middleware_1.generalFields.file(cloud_multer_1.fileValidation.image)).max(2).optional(),
        tags: zod_1.z.array(validation_middleware_1.generalFields.id).max(10).optional(),
    }).superRefine((data, ctx) => {
        if (!data.content && !data.attachments?.length) {
            ctx.addIssue({ code: "custom", message: "content or attachments is required", path: ["content"] });
        }
        if (data.tags?.length && data.tags.length !== [...new Set(data.tags)].length) {
            ctx.addIssue({ code: "custom", message: "duplicated tagged users", path: ["tags"] });
        }
    }),
};
exports.replyOnComment = {
    params: exports.createComment.params.extend({
        commentId: validation_middleware_1.generalFields.id,
    }),
    body: exports.createComment.body,
};
