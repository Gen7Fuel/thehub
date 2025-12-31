import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_navbarLayout/category/')({
  component: RouteComponent,
});

interface Category {
  _id?: string;
  Number: number;
  Name: string;
  CycleCountVariance: number;
  OrderRecVariance: number;
  _open?: boolean;
}

function RouteComponent() {
  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch all categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get('/api/product-category', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      // Add _open property for toggling accordion
      const catsWithOpen = res.data.map((c: Category) => ({ ...c, _open: false }));
      setCategories(catsWithOpen);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Toggle accordion
  const toggleCategory = (idx: number) => {
    const cat = filteredCategories[idx]; // clicked category
    setCategories(prev =>
      prev.map(c =>
        c._id === cat._id ? { ...c, _open: !c._open } : { ...c, _open: false }
      )
    );
  };


  // Open add/update dialog
  const openUpdateDialog = (category: Category) => {
    setSelectedCategory(category);
    setDialogOpen(true);
  };

  // Filtered categories by search
  const filteredCategories = categories.filter(
    c =>
      c.Name.toLowerCase().includes(search.toLowerCase()) ||
      c.Number.toString().includes(search)
  );

  // Add new category
  const addCategory = async (category: Category) => {
    try {
      const res = await axios.post('/api/product-category', category, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setCategories(prev => [...prev, { ...res.data, _open: false }]);
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to add category', err);
    }
  };

  // Update existing category
  const updateCategory = async (category: Category) => {
    if (!category._id) return;
    try {
      const res = await axios.put(`/api/product-category/${category._id}`, category, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      setCategories(prev =>
        prev.map(c => (c._id === category._id ? { ...res.data, _open: false } : c))
      );
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };


  return (
    <>
      <div className="pt-8"></div> {/* spacer for fixed navbar */}
      <div className="max-w-5xl mx-auto py-8 p-4 border rounded">{/* increased padding-top to avoid navbar */}
        <div className="w-full max-w-4xl bg-white shadow-md rounded-lg p-6">
          {/* Search + Add button */}
          <div className="flex gap-2 mb-4 sticky top-0 bg-white z-10 p-2 rounded">
            <Input
              placeholder="Search by name or number"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Button
              onClick={() =>
                openUpdateDialog({ Name: '', Number: 0, CycleCountVariance: 1, OrderRecVariance: 1 })
              }
            >
              Add New Category
            </Button>
          </div>

          {/* Accordion for categories */}
          <div className="space-y-3 mt-4">
            {filteredCategories.map((cat, idx) => (
              <div key={idx} className="border rounded-lg bg-white shadow-sm">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(idx)}
                  className="w-full text-left px-4 py-3 flex justify-between items-center bg-gray-50 border-b"
                >
                  <span className="font-semibold">
                    {cat.Number} — {cat.Name}
                  </span>
                  <span className="text-xl">{cat._open ? '−' : '+'}</span>
                </button>

                {/* Accordion Content */}
                {cat._open && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-medium">Name</label>
                        <div className="p-2 border rounded">{cat.Name}</div>
                      </div>
                      <div>
                        <label className="font-medium">Number</label>
                        <div className="p-2 border rounded">{cat.Number}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-medium">Cycle Count Variance</label>
                        <div className="p-2 border rounded">{cat.CycleCountVariance}</div>
                      </div>
                      <div>
                        <label className="font-medium">Order Rec Variance</label>
                        <div className="p-2 border rounded">{cat.OrderRecVariance}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <Button onClick={() => openUpdateDialog(cat)}>Update Category</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dialog for Add/Update */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedCategory?.Name ? 'Update Category' : 'Add New Category'}
                </DialogTitle>
              </DialogHeader>

              {selectedCategory && (
                <div className="space-y-2 mt-2">
                  <div>
                    <label>Name</label>
                    <Input
                      value={selectedCategory.Name}
                      onChange={e =>
                        setSelectedCategory(prev => ({ ...prev!, Name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label>Number</label>
                    <Input
                      type="number"
                      value={selectedCategory.Number}
                      onChange={e =>
                        setSelectedCategory(prev => ({ ...prev!, Number: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label>CycleCountVariance</label>
                    <Input
                      type="number"
                      value={selectedCategory.CycleCountVariance}
                      onChange={e =>
                        setSelectedCategory(prev => ({
                          ...prev!,
                          CycleCountVariance: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label>OrderRecVariance</label>
                    <Input
                      type="number"
                      value={selectedCategory.OrderRecVariance}
                      onChange={e =>
                        setSelectedCategory(prev => ({
                          ...prev!,
                          OrderRecVariance: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() =>
                        selectedCategory._id
                          ? updateCategory(selectedCategory)
                          : addCategory(selectedCategory)
                      }
                    >
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );

};