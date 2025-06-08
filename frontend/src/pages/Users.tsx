import React from 'react'
import { Users as UsersIcon } from 'lucide-react'

export function Users() {
  return (
    <div className="text-center py-12">
      <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">Users Management</h3>
      <p className="mt-1 text-sm text-gray-500">
        This page will contain user management functionality.
      </p>
      <div className="mt-6">
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Coming Soon
        </button>
      </div>
    </div>
  )
} 