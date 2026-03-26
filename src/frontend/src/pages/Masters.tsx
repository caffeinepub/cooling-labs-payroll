import { Edit2, MapPin, Plus, Search } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import * as mastersStorage from "../services/mastersStorage";
import type { Department, Site, Trade } from "../types";

type MasterItem = { id: string; name: string; status: string };

function MasterSection<T extends MasterItem>({
  items,
  onAdd,
  onEdit,
  onToggle,
  entityName,
}: {
  items: T[];
  onAdd: (name: string) => boolean;
  onEdit: (id: string, name: string, status: string) => boolean;
  onToggle: (item: T) => void;
  entityName: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const handleAdd = useCallback(() => {
    if (!newName.trim()) {
      setError("Name is required");
      return;
    }
    setError("");
    const ok = onAdd(newName.trim());
    if (ok) {
      setNewName("");
      setAddOpen(false);
    } else {
      setError(`A ${entityName.toLowerCase()} with that name already exists`);
    }
  }, [newName, onAdd, entityName]);

  const handleEdit = useCallback(() => {
    if (!editItem) return;
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }
    setError("");
    const ok = onEdit(editItem.id, editName.trim(), editItem.status);
    if (ok) {
      setEditItem(null);
    } else {
      setError("Failed to update");
    }
  }, [editItem, editName, onEdit]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${entityName}...`}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setNewName("");
            setError("");
            setAddOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add {entityName}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title={`No ${entityName} found`}
            subtitle={`Add a new ${entityName} to get started`}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      variant={item.status === "active" ? "active" : "inactive"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditItem(item);
                          setEditName(item.name);
                          setError("");
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggle(item)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          item.status === "active"
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-green-200 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {item.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add {entityName}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div>
              <Label htmlFor="master-add-name" className="mb-1.5 block">
                Name *
              </Label>
              <Input
                id="master-add-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={`Enter ${entityName.toLowerCase()} name`}
                autoFocus
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add {entityName}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {entityName}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div>
              <Label htmlFor="master-edit-name" className="mb-1.5 block">
                Name *
              </Label>
              <Input
                id="master-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Site Master with geo-fence ---

const EMPTY_SITE_FORM = {
  siteCode: "",
  name: "",
  lat: "",
  lng: "",
  radiusMeters: "100",
};

function SiteSection({
  items,
  onRefresh,
  addToast,
}: {
  items: Site[];
  onRefresh: () => void;
  addToast: (msg: string, type: import("../hooks/useToast").ToastType) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Site | null>(null);
  const [form, setForm] = useState(EMPTY_SITE_FORM);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const handleAdd = useCallback(() => {
    if (!form.siteCode.trim()) {
      setError("Site Code is required");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setError("");
    const ok = mastersStorage.createSite(
      form.siteCode.trim(),
      form.name.trim(),
      Number.parseFloat(form.lat) || 0,
      Number.parseFloat(form.lng) || 0,
      Number.parseFloat(form.radiusMeters) || 100,
    );
    if (ok) {
      addToast("Site added", "success");
      setForm(EMPTY_SITE_FORM);
      setAddOpen(false);
      onRefresh();
    } else {
      setError("A site with that name already exists");
    }
  }, [form, addToast, onRefresh]);

  const handleEdit = useCallback(() => {
    if (!editItem) return;
    if (!form.siteCode.trim()) {
      setError("Site Code is required");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setError("");
    const ok = mastersStorage.updateSite(
      editItem.id,
      form.siteCode.trim(),
      form.name.trim(),
      editItem.status,
      Number.parseFloat(form.lat) || 0,
      Number.parseFloat(form.lng) || 0,
      Number.parseFloat(form.radiusMeters) || 100,
    );
    if (ok) {
      addToast("Site updated", "success");
      setEditItem(null);
      onRefresh();
    } else {
      setError("Failed to update site");
    }
  }, [editItem, form, addToast, onRefresh]);

  const handleToggle = useCallback(
    (item: Site) => {
      const newStatus = item.status === "active" ? "inactive" : "active";
      const ok = mastersStorage.updateSite(
        item.id,
        item.siteCode || "",
        item.name,
        newStatus,
        item.lat,
        item.lng,
        item.radiusMeters,
      );
      if (ok) {
        addToast(
          `Site ${newStatus === "active" ? "activated" : "deactivated"}`,
          "success",
        );
        onRefresh();
      }
    },
    [addToast, onRefresh],
  );

  const SiteForm = (
    <div className="space-y-3">
      <div>
        <Label className="mb-1.5 block">Site Code *</Label>
        <Input
          value={form.siteCode}
          onChange={(e) =>
            setForm((p) => ({ ...p, siteCode: e.target.value.toUpperCase() }))
          }
          placeholder="e.g. CL001"
          autoFocus
        />
      </div>
      <div>
        <Label className="mb-1.5 block">Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Site Alpha"
        />
        {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">
        Geo-Fence (Optional)
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs">Latitude</Label>
          <Input
            type="number"
            step="0.0001"
            value={form.lat}
            onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
            placeholder="e.g. 19.0760"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Longitude</Label>
          <Input
            type="number"
            step="0.0001"
            value={form.lng}
            onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
            placeholder="e.g. 72.8777"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Radius (meters)</Label>
          <Input
            type="number"
            min="10"
            step="10"
            value={form.radiusMeters}
            onChange={(e) =>
              setForm((p) => ({ ...p, radiusMeters: e.target.value }))
            }
            placeholder="100"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sites..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY_SITE_FORM);
            setError("");
            setAddOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Add Site
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No sites found"
            subtitle="Add a site to get started"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Site Code
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Geo-Fence
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">
                    {item.siteCode || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.lat !== 0 || item.lng !== 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5">
                        <MapPin className="w-3 h-3" />
                        {item.lat.toFixed(4)}, {item.lng.toFixed(4)} (
                        {item.radiusMeters}m)
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      variant={item.status === "active" ? "active" : "inactive"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditItem(item);
                          setForm({
                            siteCode: item.siteCode || "",
                            name: item.name,
                            lat: item.lat ? String(item.lat) : "",
                            lng: item.lng ? String(item.lng) : "",
                            radiusMeters: String(item.radiusMeters || 100),
                          });
                          setError("");
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(item)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          item.status === "active"
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-green-200 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {item.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Site</DialogTitle>
          </DialogHeader>
          <div className="py-3">{SiteForm}</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Site</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
          </DialogHeader>
          <div className="py-3">{SiteForm}</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Masters({
  section,
}: { section: "trades" | "departments" | "sites" }) {
  const {
    trades,
    departments,
    sites,
    refreshTrades,
    refreshDepartments,
    refreshSites,
  } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();

  const handleAddTrade = useCallback(
    (name: string): boolean => {
      const ok = mastersStorage.createTrade(name);
      if (ok) {
        addToast("Trade added", "success");
        refreshTrades();
      }
      return ok;
    },
    [addToast, refreshTrades],
  );

  const handleEditTrade = useCallback(
    (id: string, name: string, status: string): boolean => {
      const ok = mastersStorage.updateTrade(id, name, status);
      if (ok) {
        addToast("Trade updated", "success");
        refreshTrades();
      }
      return ok;
    },
    [addToast, refreshTrades],
  );

  const handleToggleTrade = useCallback(
    (item: Trade) => {
      const newStatus = item.status === "active" ? "inactive" : "active";
      const ok = mastersStorage.updateTrade(item.id, item.name, newStatus);
      if (ok) {
        addToast(
          `Trade ${newStatus === "active" ? "activated" : "deactivated"}`,
          "success",
        );
        refreshTrades();
      }
    },
    [addToast, refreshTrades],
  );

  const handleAddDept = useCallback(
    (name: string): boolean => {
      const ok = mastersStorage.createDepartment(name);
      if (ok) {
        addToast("Department added", "success");
        refreshDepartments();
      }
      return ok;
    },
    [addToast, refreshDepartments],
  );

  const handleEditDept = useCallback(
    (id: string, name: string, status: string): boolean => {
      const ok = mastersStorage.updateDepartment(id, name, status);
      if (ok) {
        addToast("Department updated", "success");
        refreshDepartments();
      }
      return ok;
    },
    [addToast, refreshDepartments],
  );

  const handleToggleDept = useCallback(
    (item: Department) => {
      const newStatus = item.status === "active" ? "inactive" : "active";
      const ok = mastersStorage.updateDepartment(item.id, item.name, newStatus);
      if (ok) {
        addToast(
          `Department ${newStatus === "active" ? "activated" : "deactivated"}`,
          "success",
        );
        refreshDepartments();
      }
    },
    [addToast, refreshDepartments],
  );

  const titles: Record<string, string> = {
    trades: "Trade Master",
    departments: "Department Master",
    sites: "Site Master",
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {titles[section]}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {section === "trades" && "Manage trade categories for employees"}
          {section === "departments" && "Manage departments for employees"}
          {section === "sites" && "Manage work sites with geo-fence boundaries"}
        </p>
      </div>

      {section === "trades" && (
        <MasterSection
          items={trades}
          onAdd={handleAddTrade}
          onEdit={handleEditTrade}
          onToggle={handleToggleTrade}
          entityName="Trade"
        />
      )}
      {section === "departments" && (
        <MasterSection
          items={departments}
          onAdd={handleAddDept}
          onEdit={handleEditDept}
          onToggle={handleToggleDept}
          entityName="Department"
        />
      )}
      {section === "sites" && (
        <SiteSection
          items={sites}
          onRefresh={refreshSites}
          addToast={addToast}
        />
      )}
    </div>
  );
}
