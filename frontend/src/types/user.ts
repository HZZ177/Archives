export interface User {
  id: number;
  username: string;
  email?: string;
  mobile?: string;
  is_active: boolean;
  is_superuser: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserState {
  currentUser: User | null;
  token: string | null;
  roles: any[];
  isLoggedIn: boolean;
}

export interface UserContextType {
  userState: UserState;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
  updateUserInfo: (user: User | null) => void;
  refreshUserInfo: () => Promise<void>;
  changePassword?: (params: ChangePasswordParams) => Promise<void>;
}

export interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResult {
  token: string;
  userinfo: User | null;
  need_change_password?: boolean;
}

export interface ChangePasswordParams {
  old_password?: string;
  new_password: string;
  is_first_login?: boolean;
} 