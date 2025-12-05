
import { User } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY_USERS = 'ironlog_users';
const STORAGE_KEY_CURRENT_USER = 'ironlog_current_user';

// Mock ID generator if uuid not available in environment context
const generateId = () => Math.random().toString(36).substr(2, 9);

const getUsers = (): User[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY_USERS);
        // Ensure we always return an array, even if JSON.parse returns null
        const parsed = data ? JSON.parse(data) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const signUp = (userData: Partial<User>): { user?: User, error?: string } => {
    const cleanEmail = userData.email?.trim();
    const cleanName = userData.name?.trim();
    const password = userData.password;
    
    if (!cleanEmail || !password || !cleanName) {
        return { error: 'Name, email and password are required.' };
    }

    const users = getUsers();
    
    // Check for existing user (case-insensitive email)
    if (users.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase())) {
        return { error: 'User with this email already exists.' };
    }

    const newUser: User = {
        id: generateId(),
        name: cleanName,
        email: cleanEmail,
        password: password,
        weight: userData.weight,
        heightFt: userData.heightFt,
        heightIn: userData.heightIn,
        sex: userData.sex,
        frequency: userData.frequency,
        goal: userData.goal,
        allowAI: userData.allowAI ?? true // Default to true if not specified, though UI should handle this
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    
    // Auto login
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(newUser));
    return { user: newUser };
};

export const updateUserProfile = (updatedUser: User): void => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
        users[index] = updatedUser;
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(updatedUser));
    }
};

export const signIn = (email: string, password: string): { user?: User, error?: string } => {
    const cleanEmail = email.trim();
    const users = getUsers();
    
    const user = users.find(u => 
        u.email.toLowerCase() === cleanEmail.toLowerCase() && u.password === password
    );

    if (!user) {
        return { error: 'Invalid email or password.' };
    }

    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    return { user };
};

export const signOut = () => {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
};

export const getCurrentUser = (): User | null => {
    try {
        const data = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};
