import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

export const MASTER_EMAIL = 'vitorleonardocl@gmail.com';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isMaster: boolean;
  isDirigente: boolean;
  isSecretaria: boolean;
  isTesouraria: boolean;
  isApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthError(null);

      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        const userPath = `users/${user.uid}`;

        try {
          // Check if document exists
          const docSnap = await getDoc(userDocRef);
          const isMasterAccount = (user.email || '').toLowerCase() === MASTER_EMAIL.toLowerCase();

          if (!docSnap.exists()) {
            // New user registration
            const initialRole: UserRole = isMasterAccount ? 'MASTER' : 'PENDING';
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
              photoURL: user.photoURL || undefined,
              role: initialRole,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          } else {
            const data = docSnap.data() as UserProfile;
            // Ensure MASTER account always has MASTER role
            if (isMasterAccount && data.role !== 'MASTER') {
              await updateDoc(userDocRef, { 
                role: 'MASTER',
                updatedAt: new Date().toISOString()
              });
              setUserProfile({ ...data, role: 'MASTER' });
            } else {
              setUserProfile(data);
            }
          }

          // Real-time listener for profile updates (e.g., when Master changes role)
          unsubscribeProfile = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data() as UserProfile);
            }
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, userPath);
          });

        } catch (err: unknown) {
          console.error("Erro ao carregar perfil do usuário:", err);
          setAuthError(err instanceof Error ? err.message : 'Falha na autenticação');
          // If error occurs reading profile, create a temporary fallback profile if Master
          if ((user.email || '').toLowerCase() === MASTER_EMAIL.toLowerCase()) {
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Vitor Leonardo (Master)',
              role: 'MASTER',
              createdAt: new Date().toISOString()
            });
          }
        } finally {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error("Erro ao fazer login com Google:", err);
      setAuthError(err instanceof Error ? err.message : 'Falha ao conectar com o Google');
      throw err;
    }
  };

  const signOutUser = async () => {
    try {
      await fbSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (err: unknown) {
      console.error("Erro ao sair:", err);
    }
  };

  // RBAC permissions
  const isMaster = useMemo(() => {
    if (!currentUser) return false;
    if ((currentUser.email || '').toLowerCase() === MASTER_EMAIL.toLowerCase()) return true;
    return userProfile?.role === 'MASTER';
  }, [currentUser, userProfile]);

  const isDirigente = useMemo(() => {
    if (isMaster) return true;
    return userProfile?.role === 'DIRIGENTE';
  }, [isMaster, userProfile]);

  const isSecretaria = useMemo(() => {
    if (isDirigente) return true;
    return userProfile?.role === 'SECRETARIA';
  }, [isDirigente, userProfile]);

  const isTesouraria = useMemo(() => {
    if (isDirigente) return true;
    return userProfile?.role === 'TESOURARIA';
  }, [isDirigente, userProfile]);

  const isApproved = useMemo(() => {
    if (isMaster) return true;
    if (!userProfile) return false;
    return ['DIRIGENTE', 'SECRETARIA', 'TESOURARIA'].includes(userProfile.role);
  }, [isMaster, userProfile]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        authError,
        signInWithGoogle,
        signOutUser,
        isMaster,
        isDirigente,
        isSecretaria,
        isTesouraria,
        isApproved
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  }
  return context;
};
