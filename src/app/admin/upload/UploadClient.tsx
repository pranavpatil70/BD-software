"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { CheckCircle2, AlertCircle, Loader2, Sparkles, SlidersHorizontal, MapPin, Tag } from 'lucide-react'

interface PreviewRow {
  rowNumber: number
  name: string
  contact: string
  hasWebsite: boolean
  firstInterest: string | null
  customFields?: Record<string, string>
  status: 'valid' | 'error'
  reason: string
}

interface MappingConfig {
  name: string
  contact: string
  website: string
  firstInterest: string
  customFields: string[]
}

export function UploadClient({ users }: { users: { id: string, displayName: string }[] }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<MappingConfig>({
    name: '',
    contact: '',
    website: '',
    firstInterest: '',
    customFields: []
  })
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'error'>('all')
  const router = useRouter()

  const fetchPreview = async (selectedFile: File, customMapping?: MappingConfig) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (customMapping) {
        formData.append('mapping', JSON.stringify(customMapping))
      }

      const res = await fetch('/api/admin/leads/preview', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')

      setColumns(data.columns || [])
      if (data.mapping) {
        setMapping(data.mapping)
      }
      setPreviewRows(data.rows || [])
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
      setFile(null)
      setColumns([])
      setPreviewRows([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    setFileName(selectedFile ? selectedFile.name : '')
    setPreviewRows([])
    setColumns([])

    if (!selectedFile) return
    await fetchPreview(selectedFile)
  }

  const handleMappingChange = async (key: keyof Omit<MappingConfig, 'customFields'>, val: string) => {
    if (!file) return
    const updated: MappingConfig = {
      ...mapping,
      [key]: val,
      // If a column is now a core field, remove it from customFields
      customFields: mapping.customFields.filter(f => f !== val)
    }
    setMapping(updated)
    await fetchPreview(file, updated)
  }

  const toggleCustomField = async (fieldName: string) => {
    if (!file) return
    const exists = mapping.customFields.includes(fieldName)
    const updatedCustom = exists
      ? mapping.customFields.filter(f => f !== fieldName)
      : [...mapping.customFields, fieldName]

    const updated: MappingConfig = {
      ...mapping,
      customFields: updatedCustom
    }
    setMapping(updated)
    await fetchPreview(file, updated)
  }

  const selectAllCustomFields = async () => {
    if (!file) return
    const coreCols = new Set([mapping.name, mapping.contact, mapping.website, mapping.firstInterest].filter(Boolean))
    const allCustom = columns.filter(c => !coreCols.has(c))
    const updated: MappingConfig = { ...mapping, customFields: allCustom }
    setMapping(updated)
    await fetchPreview(file, updated)
  }

  const clearAllCustomFields = async () => {
    if (!file) return
    const updated: MappingConfig = { ...mapping, customFields: [] }
    setMapping(updated)
    await fetchPreview(file, updated)
  }

  const handleImport = async () => {
    const validRows = previewRows.filter(r => r.status === 'valid')
    if (validRows.length === 0) return

    setImporting(true)
    try {
      const res = await fetch('/api/admin/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map(r => ({
            name: r.name,
            contact: r.contact,
            hasWebsite: r.hasWebsite,
            firstInterest: r.firstInterest,
            customFields: r.customFields
          })),
          assignedToId: assignedToId || null,
          csvName: fileName || null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')

      toast.success(`Successfully imported ${data.count} leads with custom fields`)
      router.push('/admin/leads')
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message)
    } finally {
      setImporting(false)
    }
  }

  const validCount = previewRows.filter(r => r.status === 'valid').length
  const errorCount = previewRows.filter(r => r.status === 'error').length

  const filteredRows = previewRows.filter(r => {
    if (filterView === 'valid') return r.status === 'valid'
    if (filterView === 'error') return r.status === 'error'
    return true
  })

  // Columns eligible to be custom fields (anything not used as name or contact)
  const availableCustomColumns = columns.filter(
    c => c !== mapping.name && c !== mapping.contact
  )

  return (
    <div className="space-y-6">
      {/* 1. File Upload Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <span>1. Select File</span>
              <span className="text-xs bg-gray-100 text-gray-600 font-normal px-2 py-0.5 rounded">
                CSV, Excel, or PDF
              </span>
            </h3>
            <Link 
              href="/api/admin/leads/template" 
              className="text-xs text-blue-600 hover:underline font-medium"
              target="_blank"
            >
              Download CSV template
            </Link>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-700">File (.xlsx, .xls, .csv, .pdf)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileChange}
                className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading || importing}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block text-gray-700">Assign to user (optional)</label>
              <Select 
                value={assignedToId} 
                onChange={(e) => setAssignedToId(e.target.value)}
                disabled={loading || importing}
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="py-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg shadow-xs">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-700" />
          <p className="text-sm font-medium">Parsing file and inspecting columns...</p>
        </div>
      )}

      {/* 2. Interactive Column Mapping & Custom Fields Freedom */}
      {!loading && columns.length > 0 && (
        <Card className="border-blue-100 bg-blue-50/20">
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  2. Column Mapping & Custom Fields
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confirm matched columns or pick custom fields (e.g. Location, Budget, City) to import.
                </p>
              </div>
            </div>

            {/* Core Fields Grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Name Column <span className="text-red-500">*</span>
                </label>
                <Select
                  value={mapping.name}
                  onChange={(e) => handleMappingChange('name', e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="">-- Select --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Phone / Contact Column <span className="text-red-500">*</span>
                </label>
                <Select
                  value={mapping.contact}
                  onChange={(e) => handleMappingChange('contact', e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="">-- Select --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Has Website Column <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Select
                  value={mapping.website}
                  onChange={(e) => handleMappingChange('website', e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="">-- None --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  First Interest / Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Select
                  value={mapping.firstInterest}
                  onChange={(e) => handleMappingChange('firstInterest', e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="">-- None --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>

            {/* Dynamic Custom Fields Selector (Freedom to import any field!) */}
            {availableCustomColumns.length > 0 && (
              <div className="pt-3 border-t border-gray-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Dynamic Custom Fields to Import ({mapping.customFields.length} selected)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllCustomFields}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={clearAllCustomFields}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {availableCustomColumns.map(col => {
                    const isSelected = mapping.customFields.includes(col)
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleCustomField(col)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {col.toLowerCase().includes('location') || col.toLowerCase().includes('city') ? (
                          <MapPin className="w-3 h-3" />
                        ) : (
                          <Tag className="w-3 h-3" />
                        )}
                        <span>{col}</span>
                        <span className={`text-[10px] ml-1 px-1 rounded ${isSelected ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {isSelected ? '✓' : '+'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Preview Section */}
      {!loading && previewRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">3. Preview & Validate</h3>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setFilterView('all')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                    filterView === 'all'
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  All ({previewRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterView('valid')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                    filterView === 'valid'
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Valid ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterView('error')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                    filterView === 'error'
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Errors ({errorCount})
                </button>
              </div>
            </div>

            <Button 
              onClick={handleImport} 
              disabled={validCount === 0 || importing}
              className="bg-black text-white hover:bg-gray-800 h-10 px-5 shadow-sm font-medium"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                `Import ${validCount} Valid Leads`
              )}
            </Button>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-16">Row</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Has Website</th>
                    {mapping.customFields.length > 0 && (
                      <th className="px-4 py-3">Custom Fields</th>
                    )}
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className={row.status === 'error' ? 'bg-red-50/50' : 'hover:bg-gray-50/50'}>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{row.rowNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.contact}</td>
                      <td className="px-4 py-3 text-xs">
                        {row.hasWebsite ? (
                          <span className="text-red-700 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-500">No</span>
                        )}
                      </td>
                      {mapping.customFields.length > 0 && (
                        <td className="px-4 py-3">
                          {row.customFields && Object.keys(row.customFields).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {Object.entries(row.customFields).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200"
                                >
                                  <span className="text-gray-500 font-medium">{k}:</span>
                                  <span className="font-semibold">{v}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs">
                        {row.status === 'valid' ? (
                          <span className="text-green-700 font-medium inline-flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                          </span>
                        ) : (
                          <span className="text-red-700 font-medium inline-flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            <AlertCircle className="w-3 h-3" />
                            {row.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredRows.length > 50 && (
                <div className="px-4 py-3 bg-gray-50 text-center text-xs text-gray-500 border-t border-gray-200">
                  Showing first 50 rows of {filteredRows.length}.
                </div>
              )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredRows.slice(0, 50).map((row, i) => (
                <div key={i} className={`p-4 space-y-2.5 ${row.status === 'error' ? 'bg-red-50/50' : 'bg-white'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs text-gray-400">Row {row.rowNumber}</span>
                    <span>
                      {row.status === 'valid' ? (
                        <span className="text-green-700 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                          ✓ Valid
                        </span>
                      ) : (
                        <span className="text-red-700 text-xs font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          ✗ {row.reason}
                        </span>
                      )}
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-600 font-mono mt-0.5">
                      {row.contact} • {row.hasWebsite ? 'Website: Yes' : 'Website: No'}
                    </div>
                  </div>

                  {row.customFields && Object.keys(row.customFields).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(row.customFields).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200"
                        >
                          <span className="text-gray-500 font-medium">{k}:</span>
                          <span className="font-semibold">{v}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {filteredRows.length > 50 && (
                <div className="px-4 py-3 bg-gray-50 text-center text-xs text-gray-500">
                  Showing first 50 rows of {filteredRows.length}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
