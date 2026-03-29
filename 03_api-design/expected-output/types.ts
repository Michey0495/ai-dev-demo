// ---------------------------------------------------------------------------
// TaskFlow API -- TypeScript 型定義 + Zod スキーマ
// OpenAPI 仕様 (openapi.yaml) と1対1で対応
// ---------------------------------------------------------------------------

import { z } from "zod"

// === 共通: ブランド型 ===

// UUID と日時を文字列で扱うが、Zod で形式を検証する
const uuidSchema = z.string().uuid()
const dateTimeSchema = z.string().datetime()
const dateSchema = z.string().date()
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "HEXカラーコード形式で指定")

type UUID = z.infer<typeof uuidSchema>
type DateTimeString = z.infer<typeof dateTimeSchema>
type DateString = z.infer<typeof dateSchema>

// === 共通: ページネーション ===

const paginationMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  totalCount: z.number().int().min(0),
})

type PaginationMeta = z.infer<typeof paginationMetaSchema>

function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  })
}

type PaginatedResponse<T> = {
  readonly data: readonly T[]
  readonly meta: PaginationMeta
}

function singleResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: itemSchema,
  })
}

type SingleResponse<T> = {
  readonly data: T
}

const paginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
})

type PaginationParams = z.infer<typeof paginationParamsSchema>

// === 共通: エラー (RFC 7807 Problem Details) ===

const problemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
})

type ProblemDetail = z.infer<typeof problemDetailSchema>

const validationFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
})

type ValidationFieldError = z.infer<typeof validationFieldErrorSchema>

const validationProblemDetailSchema = problemDetailSchema.extend({
  errors: z.array(validationFieldErrorSchema),
})

type ValidationProblemDetail = z.infer<typeof validationProblemDetailSchema>

// === 認証 ===

const registerRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

type RegisterRequest = z.infer<typeof registerRequestSchema>

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginRequest = z.infer<typeof loginRequestSchema>

const userSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string().email(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type User = z.infer<typeof userSchema>

const authTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: dateTimeSchema,
  user: userSchema,
})

type AuthToken = z.infer<typeof authTokenSchema>

const authTokenResponseSchema = singleResponseSchema(authTokenSchema)
type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>

// === ユーザー参照 ===

const userReferenceSchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
  })
  .nullable()

type UserReference = z.infer<typeof userReferenceSchema>

// === プロジェクト ===

const projectStatusSchema = z.enum(["active", "archived"])
type ProjectStatus = z.infer<typeof projectStatusSchema>

const projectSummarySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  status: projectStatusSchema,
  taskCount: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type ProjectSummary = z.infer<typeof projectSummarySchema>

const projectSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type Project = z.infer<typeof projectSchema>

const createProjectRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
})

type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>

const updateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
})

type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>

const listProjectsParamsSchema = paginationParamsSchema.extend({
  status: projectStatusSchema.optional(),
})

type ListProjectsParams = z.infer<typeof listProjectsParamsSchema>

// === メンバー ===

const memberRoleSchema = z.enum(["owner", "member", "guest"])
type MemberRole = z.infer<typeof memberRoleSchema>

const memberSchema = z.object({
  userId: uuidSchema,
  name: z.string(),
  email: z.string().email(),
  role: memberRoleSchema,
  joinedAt: dateTimeSchema,
})

type Member = z.infer<typeof memberSchema>

const addMemberRequestSchema = z.object({
  userId: uuidSchema,
  role: memberRoleSchema,
})

type AddMemberRequest = z.infer<typeof addMemberRequestSchema>

// === タスク ===

const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
])

type TaskStatus = z.infer<typeof taskStatusSchema>

const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"])
type TaskPriority = z.infer<typeof taskPrioritySchema>

const taskSortFieldSchema = z.enum([
  "createdAt",
  "updatedAt",
  "dueDate",
  "priority",
])

type TaskSortField = z.infer<typeof taskSortFieldSchema>

const sortOrderSchema = z.enum(["asc", "desc"])
type SortOrder = z.infer<typeof sortOrderSchema>

const labelReferenceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  color: hexColorSchema,
})

type LabelReference = z.infer<typeof labelReferenceSchema>

const taskSummarySchema = z.object({
  id: uuidSchema,
  title: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  assignee: userReferenceSchema,
  labels: z.array(labelReferenceSchema),
  dueDate: dateSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type TaskSummary = z.infer<typeof taskSummarySchema>

const taskSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  assignee: userReferenceSchema,
  labels: z.array(labelReferenceSchema),
  dueDate: dateSchema.nullable(),
  createdBy: userReferenceSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type Task = z.infer<typeof taskSchema>

const createTaskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional(),
  labelIds: z.array(uuidSchema).max(20).optional(),
  dueDate: dateSchema.optional(),
})

type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>

const updateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: dateSchema.nullable().optional(),
})

type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>

const changeTaskStatusRequestSchema = z.object({
  status: taskStatusSchema,
})

type ChangeTaskStatusRequest = z.infer<typeof changeTaskStatusRequestSchema>

const assignTaskRequestSchema = z.object({
  userId: uuidSchema,
})

type AssignTaskRequest = z.infer<typeof assignTaskRequestSchema>

const listTasksParamsSchema = paginationParamsSchema.extend({
  status: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: uuidSchema.optional(),
  labelIds: z.string().optional(),
  dueDateFrom: dateSchema.optional(),
  dueDateTo: dateSchema.optional(),
  q: z.string().max(200).optional(),
  sort: taskSortFieldSchema.default("createdAt").optional(),
  order: sortOrderSchema.default("desc").optional(),
})

type ListTasksParams = z.infer<typeof listTasksParamsSchema>

// === ラベル ===

const labelSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  color: hexColorSchema,
  createdAt: dateTimeSchema,
})

type Label = z.infer<typeof labelSchema>

const createLabelRequestSchema = z.object({
  name: z.string().min(1).max(50),
  color: hexColorSchema,
})

type CreateLabelRequest = z.infer<typeof createLabelRequestSchema>

const updateLabelRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColorSchema.optional(),
})

type UpdateLabelRequest = z.infer<typeof updateLabelRequestSchema>

// === コメント ===

const commentSchema = z.object({
  id: uuidSchema,
  body: z.string(),
  author: userReferenceSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
})

type Comment = z.infer<typeof commentSchema>

const createCommentRequestSchema = z.object({
  body: z.string().min(1).max(2000),
})

type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>

const updateCommentRequestSchema = z.object({
  body: z.string().min(1).max(2000),
})

type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>

// === ステータス遷移ルール ===

// 許可されたステータス遷移の定義
// 現在のステータスをキーに、遷移可能なステータスの配列を値とする
const ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<TaskStatus, readonly TaskStatus[]>
> = {
  todo: ["in_progress", "cancelled"],
  in_progress: ["in_review", "todo", "cancelled"],
  in_review: ["done", "in_progress"],
  done: ["in_progress"],
  cancelled: ["todo"],
} as const

function isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to)
}

// === レスポンススキーマ（具象化） ===

const userResponseSchema = singleResponseSchema(userSchema)
const projectResponseSchema = singleResponseSchema(projectSchema)
const memberResponseSchema = singleResponseSchema(memberSchema)
const taskResponseSchema = singleResponseSchema(taskSchema)
const labelResponseSchema = singleResponseSchema(labelSchema)
const commentResponseSchema = singleResponseSchema(commentSchema)

const projectSummaryListSchema = paginatedResponseSchema(projectSummarySchema)
const memberListSchema = paginatedResponseSchema(memberSchema)
const taskSummaryListSchema = paginatedResponseSchema(taskSummarySchema)
const labelListSchema = paginatedResponseSchema(labelSchema)
const commentListSchema = paginatedResponseSchema(commentSchema)

// === エクスポート: 型 ===

export type {
  UUID,
  DateTimeString,
  DateString,
  PaginationMeta,
  PaginatedResponse,
  SingleResponse,
  PaginationParams,
  ProblemDetail,
  ValidationFieldError,
  ValidationProblemDetail,
  RegisterRequest,
  LoginRequest,
  AuthToken,
  AuthTokenResponse,
  User,
  UserReference,
  ProjectStatus,
  ProjectSummary,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ListProjectsParams,
  MemberRole,
  Member,
  AddMemberRequest,
  TaskStatus,
  TaskPriority,
  TaskSortField,
  SortOrder,
  LabelReference,
  TaskSummary,
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  ChangeTaskStatusRequest,
  AssignTaskRequest,
  ListTasksParams,
  Label,
  CreateLabelRequest,
  UpdateLabelRequest,
  Comment,
  CreateCommentRequest,
  UpdateCommentRequest,
}

// === エクスポート: Zod スキーマ ===

export {
  // 基本型
  uuidSchema,
  dateTimeSchema,
  dateSchema,
  hexColorSchema,
  // ページネーション
  paginationMetaSchema,
  paginationParamsSchema,
  paginatedResponseSchema,
  singleResponseSchema,
  // エラー
  problemDetailSchema,
  validationFieldErrorSchema,
  validationProblemDetailSchema,
  // 認証
  registerRequestSchema,
  loginRequestSchema,
  authTokenSchema,
  authTokenResponseSchema,
  // ユーザー
  userSchema,
  userReferenceSchema,
  // プロジェクト
  projectStatusSchema,
  projectSummarySchema,
  projectSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  listProjectsParamsSchema,
  // メンバー
  memberRoleSchema,
  memberSchema,
  addMemberRequestSchema,
  // タスク
  taskStatusSchema,
  taskPrioritySchema,
  taskSortFieldSchema,
  sortOrderSchema,
  labelReferenceSchema,
  taskSummarySchema,
  taskSchema,
  createTaskRequestSchema,
  updateTaskRequestSchema,
  changeTaskStatusRequestSchema,
  assignTaskRequestSchema,
  listTasksParamsSchema,
  // ラベル
  labelSchema,
  createLabelRequestSchema,
  updateLabelRequestSchema,
  // コメント
  commentSchema,
  createCommentRequestSchema,
  updateCommentRequestSchema,
  // レスポンス（具象化済み）
  userResponseSchema,
  projectResponseSchema,
  memberResponseSchema,
  taskResponseSchema,
  labelResponseSchema,
  commentResponseSchema,
  projectSummaryListSchema,
  memberListSchema,
  taskSummaryListSchema,
  labelListSchema,
  commentListSchema,
  // ステータス遷移
  ALLOWED_STATUS_TRANSITIONS,
  isValidStatusTransition,
}
