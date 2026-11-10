export const ACCOUNT_PERSONAL = 1;
export const ACCOUNT_ENTERPRISE = 2;
export const ROLE_PLATFORM_ADMIN = 3;

/**
 * 空间类型。三种空间取代了旧的 `tenant_id` + `account_type` 二选一：
 * 同一个账号可以同时在个人 / 团队 / 平台三个空间里，各自有各自的资产与权限。
 *
 * 取值与后端 `/me/spaces` 的 `kind`、JWT 的 `sk`（1/2/3）一一对应。
 */
export type Workspace = 'platform' | 'team' | 'personal';
