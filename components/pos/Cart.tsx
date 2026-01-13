"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaleItem, Customer, PaymentMethod } from "@/lib/types";
import { ShoppingCart, Trash2 } from "lucide-react";
import { DiscountSection } from "./DiscountSection";

interface CartProps {
  cart: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  creditAmount: number;
  selectedCustomer: Customer | null;
  advancePayment: number;
  paymentMethod: PaymentMethod;
  processing: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  onUpdateItem: (productId: string, updates: Partial<SaleItem>) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onAdvancePaymentChange: (value: number) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
  onCheckout: () => void;
  variant?: "desktop" | "mobile";
}

export function Cart({
  cart,
  subtotal,
  discount,
  total,
  paidAmount,
  creditAmount,
  selectedCustomer,
  advancePayment,
  paymentMethod,
  processing,
  hasPermission,
  onUpdateItem,
  onRemoveItem,
  onClearCart,
  onAdvancePaymentChange,
  onPaymentMethodChange,
  onApplyDiscount,
  onRemoveDiscount,
  onCheckout,
  variant = "desktop",
}: CartProps) {
  const isMobile = variant === "mobile";

  return (
    <>
      {/* Cart Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart ({cart.length})
          </CardTitle>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Clear all items from cart?")) {
                  onClearCart();
                }
              }}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Cart Items */}
      <CardContent className={`flex-1 overflow-y-auto ${isMobile ? "p-4" : "p-4"}`}>
        {cart.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Cart is empty</div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.productId} className={`border rounded ${isMobile ? "p-4" : "p-4 md:p-3"} space-y-2`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.productName}</p>
                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={isMobile ? "h-12 w-12" : "h-12 w-12 md:h-10 md:w-10"}
                    onClick={() => onRemoveItem(item.productId)}
                  >
                    <Trash2 className={isMobile ? "h-5 w-5" : "h-5 w-5 md:h-4 md:w-4"} />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={isMobile ? "min-w-12 h-12" : "min-w-12 h-12 md:min-w-10 md:h-10"}
                    onClick={() => onUpdateItem(item.productId, { quantity: Math.max(1, item.quantity - 1) })}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateItem(item.productId, { quantity: parseInt(e.target.value) || 1 })
                    }
                    className={isMobile ? "w-16 text-center h-12" : "w-16 md:w-16 text-center h-12 md:h-10"}
                    min={1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className={isMobile ? "min-w-12 h-12" : "min-w-12 h-12 md:min-w-10 md:h-10"}
                    onClick={() => onUpdateItem(item.productId, { quantity: item.quantity + 1 })}
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
      <div className={`border-t ${isMobile ? "p-4" : "p-4"} space-y-3 bg-gray-50`}>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>Rs {subtotal.toFixed(2)}</span>
          </div>
          <DiscountSection
            discount={discount}
            hasPermission={hasPermission("pos", "applyDiscount")}
            onApplyDiscount={onApplyDiscount}
            onRemoveDiscount={onRemoveDiscount}
          />
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total:</span>
            <span>Rs {total.toFixed(2)}</span>
          </div>
          
          {/* Advance Payment Input - Only for selected customers */}
          {selectedCustomer && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor={isMobile ? "advance-payment-mobile" : "advance-payment"}>
                Advance Payment (Rs)
              </Label>
              <Input
                id={isMobile ? "advance-payment-mobile" : "advance-payment"}
                type="number"
                inputMode="decimal"
                min={0}
                max={total}
                step="0.01"
                value={advancePayment}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  onAdvancePaymentChange(Math.min(Math.max(0, value), total));
                }}
                placeholder="Enter advance payment amount"
                className={isMobile ? "h-12" : "h-12 md:h-10"}
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
          <Select value={paymentMethod} onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}>
            <SelectTrigger className={isMobile ? "h-12" : ""}>
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
          onClick={onCheckout}
          disabled={cart.length === 0 || processing}
          className={`w-full ${isMobile ? "min-h-12" : "min-h-12 md:min-h-10"}`}
          size="lg"
        >
          {processing ? "Processing..." : `Complete Sale (Rs ${paidAmount.toFixed(2)})`}
        </Button>
      </div>
    </>
  );
}

