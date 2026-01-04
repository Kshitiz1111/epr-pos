"use client";

import { useEffect, useState } from "react";
import { ProductService } from "@/lib/services/productService";
import { Product } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Fuse from "fuse.js";
import { Search, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const fuse = new Fuse(products, {
      keys: ["name", "sku", "category", "description"],
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    setFilteredProducts(results.map((result) => result.item));
  }, [searchQuery, products]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/store">
              <h1 className="text-2xl font-bold">Ghimire Kitchen Wares</h1>
            </Link>
            <Link href="/store/cart">
              <Button variant="outline">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Cart
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="container mx-auto px-4 py-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? "No products found matching your search." : "No products available."}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map((product) => {
              const totalStock = Object.values(product.warehouses).reduce(
                (sum, wh) => sum + wh.quantity,
                0
              );
              return (
                <Link key={product.id} href={`/store/${product.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-4">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-48 object-cover rounded mb-3"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded mb-3 flex items-center justify-center">
                          <span className="text-gray-400">No Image</span>
                        </div>
                      )}
                      <h3 className="font-semibold mb-2 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                      <p className="font-bold text-lg text-green-600 mb-2">
                        Rs {product.price.toFixed(2)}
                      </p>
                      {totalStock === 0 && (
                        <p className="text-xs text-red-600">Out of Stock</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

