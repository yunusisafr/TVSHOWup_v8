import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

interface AdminContextType {
  isAdmin: boolean
  adminRole: string | null
  permissions: any
  loading: boolean
  checkAdminStatus: () => Promise<boolean>
  logAdminAction: (action: string, targetType?: string, targetId?: string, details?: any) => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export const useAdmin = () => {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRole, setAdminRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const checkAdminStatus = async (): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false)
      setAdminRole(null)
      setPermissions({})
      setLoading(false)
      return false
    }

    try {
      setLoading(true)
      
      // Check if user is in admin_users table
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('role, permissions')
        .eq('id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
        setAdminRole(null)
        setPermissions({})
      } else if (adminUser) {
        setIsAdmin(true)
        setAdminRole(adminUser.role)
        setPermissions(adminUser.permissions || {})
        return true
      } else {
        setIsAdmin(false)
        setAdminRole(null)
        setPermissions({})
        return false
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
      setAdminRole(null)
      setPermissions({})
      return false
    } finally {
      setLoading(false)
    }
  }

  const logAdminAction = async (
    action: string, 
    targetType?: string, 
    targetId?: string, 
    details?: any
  ) => {
    if (!user || !isAdmin) return

    try {
      await supabase
        .from('admin_logs')
        .insert({
          admin_id: user.id,
          action,
          target_type: targetType,
          target_id: targetId,
          details: details || {},
          ip_address: null, // Could be populated with actual IP
          user_agent: navigator.userAgent
        })
    } catch (error) {
      console.error('Error logging admin action:', error)
    }
  }

  useEffect(() => {
    if (user) {
      setLoading(true);
      checkAdminStatus().finally(() => {
        setLoading(false);
      });
    } else {
      setIsAdmin(false);
      setAdminRole(null);
      setPermissions({});
    }
  }, [user])

  const value = {
    isAdmin,
    adminRole,
    permissions,
    loading,
    checkAdminStatus,
    logAdminAction
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}