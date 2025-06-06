export interface User {
  id: number;
  username: string;
  email?: string;
  mobile?: string;
  full_name?: string;
  status?: number;
  is_active?: boolean;
  is_superuser?: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface UserFormData {
  username: string;
  password?: string;
  email?: string;
  mobile?: string;
  status?: number;
  role_ids?: number[];
}

export interface UserQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  token: string;
  userinfo: User;
  need_change_password?: boolean;
}

export interface ChangePasswordParams {
  old_password: string;
  new_password: string;
}

export interface UserState {
  currentUser: User | null;
  token: string | null;
  roles: Role[];
  isLoggedIn: boolean;
}

export interface UserContextType {
  userState: UserState;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
  updateUserInfo: (user: User) => void;
  refreshUserInfo: () => Promise<void>;
  changePassword?: (params: ChangePasswordParams) => Promise<void>;
} 