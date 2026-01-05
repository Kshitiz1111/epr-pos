"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaleService } from "@/lib/services/saleService";
import { ProductService } from "@/lib/services/productService";
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner";
import { Product, SaleItem, Customer, PaymentMethod } from "@/lib/types";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Fuse from "fuse.js";
import { Search, Trash2, ShoppingCart, User, Menu, X, LayoutDashboard, Package, User as UserIcon, LogOut, Users, Warehouse, Building2, DollarSign, CreditCard, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function POSPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [advancePayment, setAdvancePayment] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: ["name", "sku", "category"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    setFilteredProducts(results.map((result) => result.item));
  }, [searchQuery, products]);

  // Update advance payment when total changes (for selected customers)
  useEffect(() => {
    if (selectedCustomer) {
      const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal;
      // Only update if current advance payment exceeds new total
      if (advancePayment > total) {
        setAdvancePayment(total);
      }
    }
  }, [cart, selectedCustomer, advancePayment]);

  // Barcode scanner integration
  useBarcodeScanner({
    onScan: (barcode) => {
      const product = products.find((p) => p.sku === barcode);
      if (product) {
        addToCart(product);
      }
    },
    enabled: true,
  });

  const fetchProducts = async () => {
    try {
      const productList = await ProductService.getAllProducts();
      const activeProducts = productList.filter((p) => p.isActive);
      setProducts(activeProducts);
      setFilteredProducts(activeProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "customers"));
      const customerList: Customer[] = [];
      querySnapshot.forEach((doc) => {
        customerList.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(customerList);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.productId === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
            : item
        )
      );
    } else {
      const effectivePrice = product.discount && product.discount > 0
        ? product.price * (1 - product.discount / 100)
        : product.price;
      
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice: effectivePrice,
          discount: product.discount || 0,
          subtotal: effectivePrice,
        },
      ]);
    }
  };

  const updateCartItem = (productId: string, updates: Partial<SaleItem>) => {
    setCart(
      cart.map((item) =>
        item.productId === productId
          ? {
              ...item,
              ...updates,
              subtotal: (updates.quantity || item.quantity) * (updates.unitPrice || item.unitPrice) - (updates.discount || item.discount || 0),
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = 0; // Can be added later
    const total = subtotal - discount;
    
    // For walk-in customers, they must pay full amount
    // For selected customers, use advance payment
    const paidAmount = selectedCustomer 
      ? Math.min(advancePayment, total) // Advance payment cannot exceed total
      : total; // Walk-in must pay full amount
    
    const creditAmount = selectedCustomer ? Math.max(0, total - paidAmount) : 0;

    return { subtotal, discount, total, paidAmount, creditAmount };
  };

  const handleCheckout = async () => {
    if (!user || cart.length === 0) return;

    const { total, paidAmount, creditAmount } = calculateTotals();
    
    // Validation: For walk-in customers, they must pay full amount
    if (!selectedCustomer && paidAmount < total) {
      alert("Walk-in customers must pay the full amount. Please select a customer if you want to allow credit.");
      return;
    }
    
    // Validation: For selected customers, advance payment must be valid
    if (selectedCustomer && advancePayment < 0) {
      alert("Advance payment cannot be negative.");
      return;
    }
    
    if (selectedCustomer && advancePayment > total) {
      alert("Advance payment cannot exceed the total amount.");
      return;
    }

    setProcessing(true);

    try {
      await SaleService.createSale(
        {
          items: cart,
          subtotal: calculateTotals().subtotal,
          discount: 0,
          total,
          paidAmount,
          dueAmount: creditAmount,
          paymentMethod,
          isCredit: creditAmount > 0,
          performedBy: user.uid,
          source: "POS", // Tag as POS sale
        },
        selectedCustomer?.id
      );

      // Reset cart and form
      setCart([]);
      setSelectedCustomer(null);
      setAdvancePayment(0);
      alert("Sale completed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete sale";
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const { subtotal, discount, total, paidAmount, creditAmount } = calculateTotals();

  return (
    <ProtectedRoute requiredPermission={{ resource: "pos", action: "create" }}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b p-2 md:p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
              {/* Sidebar Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-10 w-10 md:h-9 md:w-9"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h1 className="text-lg md:text-2xl font-bold">Point of Sale</h1>
            </div>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto">
              <Select value={selectedCustomer?.id || "walk-in"} onValueChange={(value) => {
                if (value === "walk-in") {
                  setSelectedCustomer(null);
                  setAdvancePayment(0); // Reset advance payment for walk-in
                } else {
                  const customer = customers.find((c) => c.id === value);
                  setSelectedCustomer(customer || null);
                  // Set default advance payment to total when customer is selected
                  const { total } = calculateTotals();
                  setAdvancePayment(total);
                }
              }}>
                <SelectTrigger className="w-full md:w-64 h-12 md:h-10">
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => router.push("/admin/customers/create")}
                className="w-full md:w-auto h-12 md:h-10"
              >
                <User className="mr-2 h-4 w-4" />
                New Customer
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          {sidebarOpen && (
            <aside className="w-64 bg-white border-r flex flex-col">
              <div className="flex flex-col h-full">
                {/* Logo/Header */}
                <div className="p-6 border-b">
                  <h1 className="text-xl font-bold">Ghimire Kitchen</h1>
                  <p className="text-sm text-gray-500">POS System</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                  <Link
                    href="/pos"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      pathname === "/pos"
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>POS</span>
                  </Link>

                  {user?.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname === "/admin"
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      <span>Dashboard</span>
                    </Link>
                  )}

                  {hasPermission("employees", "view") && (
                    <Link
                      href="/admin/employees"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/employees")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Users className="h-5 w-5" />
                      <span>Employees</span>
                    </Link>
                  )}

                  {hasPermission("inventory", "view") && (
                    <Link
                      href="/admin/inventory/products"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/inventory/products")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Package className="h-5 w-5" />
                      <span>Products</span>
                    </Link>
                  )}

                  {hasPermission("inventory", "view") && (
                    <Link
                      href="/admin/inventory/warehouses"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/inventory/warehouses")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Warehouse className="h-5 w-5" />
                      <span>Warehouses</span>
                    </Link>
                  )}

                  {hasPermission("vendors", "view") && (
                    <Link
                      href="/admin/vendors"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/vendors")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                      <span>Vendors</span>
                    </Link>
                  )}

                  {hasPermission("finance", "view") && (
                    <Link
                      href="/admin/finance/ledger"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/finance")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <DollarSign className="h-5 w-5" />
                      <span>Finance</span>
                    </Link>
                  )}

                  {hasPermission("customers", "view") && (
                    <Link
                      href="/admin/customers"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/customers") && !pathname?.startsWith("/admin/customers/credits")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <UserIcon className="h-5 w-5" />
                      <span>Customers</span>
                    </Link>
                  )}

                  {hasPermission("customers", "viewCredits") && (
                    <Link
                      href="/admin/customers/credits"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/customers/credits")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <CreditCard className="h-5 w-5" />
                      <span>Customer Credits</span>
                    </Link>
                  )}

                  {user?.role === "admin" && (
                    <Link
                      href="/admin/orders"
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        pathname?.startsWith("/admin/orders")
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <ShoppingBag className="h-5 w-5" />
                      <span>Orders</span>
                    </Link>
                  )}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t space-y-2">
                  {user && (
                    <div className="px-4 py-2 text-sm">
                      <p className="font-medium">{user.displayName || user.email}</p>
                      <p className="text-gray-500 text-xs capitalize">{user.role}</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      await signOut();
                      router.push("/login");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </aside>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-gray-50">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search products or scan barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 md:h-10"
                  autoFocus
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading products...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                {filteredProducts.map((product) => {
                  const totalStock = Object.values(product.warehouses).reduce(
                    (sum, wh) => sum + wh.quantity,
                    0
                  );
                  return (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-lg active:scale-95 transition-all min-h-[120px] md:min-h-[150px]"
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-2 md:p-4">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-24 md:h-32 object-cover rounded mb-2"
                          />
                        ) : (
                          <div className="w-full h-24 md:h-32 bg-gray-200 rounded mb-2 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No Image</span>
                          </div>
                        )}
                        <h3 className="font-semibold text-xs md:text-sm mb-1 line-clamp-2">{product.name}</h3>
                        <p className="text-xs text-gray-500 mb-1">SKU: {product.sku}</p>
                        {product.discount && product.discount > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 line-through">Rs {product.price.toFixed(2)}</p>
                            <p className="font-bold text-green-600 text-xs md:text-sm">
                              Rs {(product.price * (1 - product.discount / 100)).toFixed(2)}
                            </p>
                            <p className="text-xs text-red-600 font-semibold">-{product.discount.toFixed(0)}%</p>
                          </div>
                        ) : (
                          <p className="font-bold text-green-600 text-xs md:text-sm">Rs {product.price.toFixed(2)}</p>
                        )}
                        <p className={`text-xs ${totalStock === 0 ? "text-red-600" : "text-gray-500"}`}>
                          Stock: {totalStock}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Sidebar - Desktop Only */}
          <div className="hidden md:flex w-96 bg-white border-l flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Cart is empty</div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.productId} className="border rounded p-4 md:p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-12 w-12 md:h-10 md:w-10"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-5 w-5 md:h-4 md:w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-12 h-12 md:min-w-10 md:h-10"
                          onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItem(item.productId, { quantity: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 md:w-16 text-center h-12 md:h-10"
                          min={1}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-12 h-12 md:min-w-10 md:h-10"
                          onClick={() => updateCartItem(item.productId, { quantity: item.quantity + 1 })}
                        >
                          +
                        </Button>
                      </div>
                      <p className="text-right font-semibold">Rs {item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            {/* Cart Summary */}
            <div className="border-t p-4 space-y-3 bg-gray-50">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>Rs {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>Rs {discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>Rs {total.toFixed(2)}</span>
                </div>
                
                {/* Advance Payment Input - Only for selected customers */}
                {selectedCustomer && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="advance-payment">Advance Payment (Rs)</Label>
                    <Input
                      id="advance-payment"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={total}
                      step="0.01"
                      value={advancePayment}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setAdvancePayment(Math.min(Math.max(0, value), total));
                      }}
                      placeholder="Enter advance payment amount"
                      className="h-12 md:h-10"
                    />
                    <p className="text-xs text-gray-500">
                      Customer will pay Rs {advancePayment.toFixed(2)} now, remaining Rs {Math.max(0, total - advancePayment).toFixed(2)} will be credit
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between text-sm text-green-600 border-t pt-2">
                  <span>Paid:</span>
                  <span>Rs {paidAmount.toFixed(2)}</span>
                </div>
                {selectedCustomer && creditAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Credit (Pay Later):</span>
                    <span>Rs {creditAmount.toFixed(2)}</span>
                  </div>
                )}
                {!selectedCustomer && (
                  <div className="text-xs text-gray-500 pt-1">
                    Walk-in customers must pay full amount
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="FONE_PAY">FonePay</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
                className="w-full min-h-12 md:min-h-10"
                size="lg"
              >
                {processing ? "Processing..." : `Complete Sale (Rs ${paidAmount.toFixed(2)})`}
              </Button>
            </div>
          </div>
          </div>
        </div>

        {/* Floating Cart Button - Mobile Only */}
        {cart.length > 0 && (
          <Button
            onClick={() => setCartOpen(true)}
            className="fixed bottom-4 right-4 md:hidden z-50 h-14 w-14 rounded-full shadow-lg"
            size="lg"
          >
            <div className="relative">
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
          </Button>
        )}

        {/* Bottom Sheet Cart - Mobile Only */}
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length})
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Cart is empty</div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.productId} className="border rounded p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-12 w-12"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-12 h-12"
                          onClick={() => updateCartItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItem(item.productId, { quantity: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 text-center h-12"
                          min={1}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-w-12 h-12"
                          onClick={() => updateCartItem(item.productId, { quantity: item.quantity + 1 })}
                        >
                          +
                        </Button>
                      </div>
                      <p className="text-right font-semibold">Rs {item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Summary - Fixed at bottom */}
            <div className="border-t p-4 space-y-3 bg-gray-50">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>Rs {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span>Rs {discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>Rs {total.toFixed(2)}</span>
                </div>
                
                {/* Advance Payment Input - Only for selected customers */}
                {selectedCustomer && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="advance-payment-mobile">Advance Payment (Rs)</Label>
                    <Input
                      id="advance-payment-mobile"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={total}
                      step="0.01"
                      value={advancePayment}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setAdvancePayment(Math.min(Math.max(0, value), total));
                      }}
                      placeholder="Enter advance payment amount"
                      className="h-12"
                    />
                    <p className="text-xs text-gray-500">
                      Customer will pay Rs {advancePayment.toFixed(2)} now, remaining Rs {Math.max(0, total - advancePayment).toFixed(2)} will be credit
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between text-sm text-green-600 border-t pt-2">
                  <span>Paid:</span>
                  <span>Rs {paidAmount.toFixed(2)}</span>
                </div>
                {selectedCustomer && creditAmount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Credit (Pay Later):</span>
                    <span>Rs {creditAmount.toFixed(2)}</span>
                  </div>
                )}
                {!selectedCustomer && (
                  <div className="text-xs text-gray-500 pt-1">
                    Walk-in customers must pay full amount
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="FONE_PAY">FonePay</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => {
                  handleCheckout();
                  setCartOpen(false);
                }}
                disabled={cart.length === 0 || processing}
                className="w-full min-h-12"
                size="lg"
              >
                {processing ? "Processing..." : `Complete Sale (Rs ${paidAmount.toFixed(2)})`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </ProtectedRoute>
  );
}

