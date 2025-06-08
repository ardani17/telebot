import React from 'react'
import { Files as FilesIcon } from 'lucide-react'

export function Files() {
  return (
    <div className="text-center py-12">
      <FilesIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">Files Management</h3>
      <p className="mt-1 text-sm text-gray-500">
        This page will contain file management functionality.
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