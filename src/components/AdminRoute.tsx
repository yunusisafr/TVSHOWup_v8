import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdmin } from '../contexts/AdminContext'
import { isAdminRoute } from '../lib/utils'
import { verifyAndRefreshSession } from '../lib/supabase'

interface AdminRouteProps {
  children: React.ReactNode
  requiredRole?: 'admin' | 'moderator' | 'editor'
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children, requiredRole = 'admin' }) => {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, adminRole, loading: adminLoading } = useAdmin()
  const location = useLocation()
  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)

  // Check if we're on the admin subdomain
  const onAdminSubdomain = isAdminRoute()

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('🔍 AdminRoute: Checking session validity...')
        const isValid = await verifyAndRefreshSession()

        if (isValid) {
          console.log('✅ AdminRoute: Valid session confirmed')
          setSessionValid(true)
        } else {
          console.log('⚠️ AdminRoute: Session validation failed')
          setSessionValid(false)
        }
      } catch (err) {
        console.error('❌ AdminRoute: Unexpected error checking session:', err)
        setSessionValid(false)
      } finally {
        setSessionChecked(true)
      }
    }

    if (onAdminSubdomain) {
      checkSession()
    } else {
      setSessionChecked(true)
    }
  }, [onAdminSubdomain])

  // If not on admin subdomain, block access completely
  if (!onAdminSubdomain) {
    console.log('⚠️ AdminRoute: Not on admin subdomain, blocking access')
    const mainDomain = window.location.hostname.includes('localhost')
      ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}`
      : 'https://tvshowup.com';
    window.location.href = `${mainDomain}/en`;
    return null;
  }

  // Show loading while checking session and authentication
  if (!sessionChecked || authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Redirect to admin login if not authenticated
  if (!user || !sessionValid) {
    console.log('🔄 AdminRoute: Redirecting to admin login. User:', user?.id, 'Session valid:', sessionValid)
    return <Navigate to="/login" replace />
  }

  // Redirect to admin login if not admin
  if (!isAdmin) {
    console.log('⚠️ AdminRoute: User is not admin, redirecting to admin login')
    return <Navigate to="/login" replace />
  }

  // Check role hierarchy: admin > moderator > editor
  const roleHierarchy = { admin: 3, moderator: 2, editor: 1 }
  const userRoleLevel = roleHierarchy[adminRole as keyof typeof roleHierarchy] || 0
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0

  if (userRoleLevel < requiredRoleLevel) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default AdminRoute