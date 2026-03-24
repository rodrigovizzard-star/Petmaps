import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { userService } from '../services/userService';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await userService.getUserProfile(user.uid);
      setProfile(userProfile);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          let userProfile = await userService.getUserProfile(firebaseUser.uid);
          
          // If profile doesn't exist, create a default tutor profile
          if (!userProfile) {
            console.log('Creating automatic tutor profile for:', firebaseUser.email);
            userProfile = await userService.createUserProfile(firebaseUser.uid, {
              email: firebaseUser.email || '',
              nome: firebaseUser.displayName || '',
              displayName: firebaseUser.displayName || '',
              fotoPerfil: firebaseUser.photoURL || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'tutor',
            });
          }
          
          if (userProfile) {
            // Migration: Ensure cidade_search is normalized as an array
            const city = userProfile.cidade || '';
            const normalized = city.toLowerCase().replace(/\s*-\s*/g, '-');
            const base = city.toLowerCase().split('-')[0].trim();
            const expected = city ? [normalized, base] : [];
            
            const updates: any = {};
            const needsCityUpdate = city && (
              !Array.isArray(userProfile.cidade_search) || 
              userProfile.cidade_search.length !== expected.length ||
              !expected.every(val => userProfile.cidade_search?.includes(val))
            );
            
            if (needsCityUpdate) {
              updates.cidade_search = expected;
              userProfile.cidade_search = expected;
            }
            
            if (Object.keys(updates).length > 0) {
              await userService.updateUserProfile(firebaseUser.uid, updates);
            }
          }
          
          setProfile(userProfile);
        } catch (error) {
          console.error('Error fetching/creating profile in AuthContext:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
