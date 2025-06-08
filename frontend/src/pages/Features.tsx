import { useState, useEffect } from 'react'
import { 
  Settings as FeaturesIcon, 
  ToggleLeft, 
  ToggleRight,
  Search,
  RefreshCw,
  Users as UsersIcon,
  UserPlus,
  UserMinus,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { api } from '@/lib/api'
import { Feature, FeatureStats } from '@/types/feature'
import { User } from '@/types/user'

interface FeatureAccessDialogProps {
  isOpen: boolean
  onClose: () => void
  feature: Feature | null
  onSuccess: () => void
}

function FeatureAccessDialog({ isOpen, onClose, feature, onSuccess }: FeatureAccessDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen && feature) {
      fetchData()
    }
  }, [isOpen, feature])

  const fetchData = async () => {
    if (!feature) return
    
    setLoading(true)
    try {
      const usersRes = await api.get('/admin/users')
      setUsers(usersRes.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGrantAccess = async (user: User) => {
    if (!feature) return
    
    setActionLoading(user.id)
    try {
      await api.post('/admin/features/grant', {
        telegramId: user.telegramId,
        featureName: feature.name
      })
      await fetchData()
      onSuccess()
    } catch (error) {
      console.error('Failed to grant access:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeAccess = async (user: User) => {
    if (!feature) return
    
    setActionLoading(user.id)
    try {
      await api.post('/admin/features/revoke', {
        telegramId: user.telegramId,
        featureName: feature.name
      })
      await fetchData()
      onSuccess()
    } catch (error) {
      console.error('Failed to revoke access:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.telegramId.includes(searchTerm) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const userHasAccess = (user: User) => {
    return user.featureAccess?.some(access => access.feature.name === feature?.name) || false
  }

  if (!isOpen || !feature) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Manage Access: {feature.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const hasAccess = userHasAccess(user)
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">
                          @{user.username || 'No username'} • ID: {user.telegramId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        hasAccess ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {hasAccess ? 'Has Access' : 'No Access'}
                      </span>
                      <button
                        onClick={() => hasAccess ? handleRevokeAccess(user) : handleGrantAccess(user)}
                        disabled={actionLoading === user.id}
                        className={`p-1 rounded ${
                          hasAccess 
                            ? 'text-red-600 hover:text-red-800' 
                            : 'text-green-600 hover:text-green-800'
                        } disabled:opacity-50`}
                      >
                        {actionLoading === user.id ? (
                          <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                        ) : hasAccess ? (
                          <UserMinus className="h-4 w-4" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Features() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [stats, setStats] = useState<FeatureStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [accessDialogOpen, setAccessDialogOpen] = useState(false)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

  const fetchFeatures = async () => {
    try {
      setLoading(true)
      const [featuresRes, statsRes] = await Promise.all([
        api.get('/admin/features'),
        api.get('/admin/stats/features')
      ])
      setFeatures(featuresRes.data)
      setStats(statsRes.data)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load features')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeatures()
  }, [])

  const handleToggleFeature = async (feature: Feature) => {
    setToggleLoading(feature.id)
    try {
      await api.patch(`/admin/features/${feature.name}`, {
        isEnabled: !feature.isEnabled
      })
      await fetchFeatures()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle feature')
    } finally {
      setToggleLoading(null)
    }
  }

  const filteredFeatures = features.filter(feature =>
    feature.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    feature.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feature Management</h1>
            <p className="mt-1 text-sm text-gray-600">
              Enable/disable features and manage user access
            </p>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search features..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchFeatures}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Features Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <FeaturesIcon className="h-6 w-6 text-blue-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Total Features</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalFeatures}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Enabled</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.enabledFeatures}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <XCircle className="h-6 w-6 text-red-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Disabled</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.disabledFeatures}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center">
              <UsersIcon className="h-6 w-6 text-purple-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Assignments</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.totalAssignments}</p>
          </div>
        </div>
      )}

      {/* Features Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredFeatures.map((feature) => (
              <tr key={feature.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8">
                      <FeaturesIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{feature.name}</div>
                      <div className="text-sm text-gray-500">ID: {feature.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    feature.isEnabled 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {feature.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={feature.description}>
                    {feature.description}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {formatDate(feature.updatedAt)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => {
                        setSelectedFeature(feature)
                        setAccessDialogOpen(true)
                      }}
                      className="text-purple-600 hover:text-purple-900 p-1 rounded"
                      title="Manage user access"
                    >
                      <UsersIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleFeature(feature)}
                      disabled={toggleLoading === feature.id}
                      className={`p-1 rounded ${
                        feature.isEnabled 
                          ? 'text-red-600 hover:text-red-900' 
                          : 'text-green-600 hover:text-green-900'
                      } disabled:opacity-50`}
                      title={feature.isEnabled ? 'Disable feature' : 'Enable feature'}
                    >
                      {toggleLoading === feature.id ? (
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      ) : feature.isEnabled ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredFeatures.length === 0 && (
          <div className="text-center py-12">
            <FeaturesIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No features found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Try adjusting your search terms.' : 'No features available.'}
            </p>
          </div>
        )}
      </div>

      {/* Feature Access Dialog */}
      <FeatureAccessDialog
        isOpen={accessDialogOpen}
        onClose={() => {
          setAccessDialogOpen(false)
          setSelectedFeature(null)
        }}
        feature={selectedFeature}
        onSuccess={fetchFeatures}
      />
    </div>
  )
} 