"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HRService } from "@/lib/services/hrService";
import { AttendanceRecord } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { Clock } from "lucide-react";

export default function AttendancePage() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTodayAttendance();
    }
  }, [user]);

  const fetchTodayAttendance = async () => {
    if (!user) return;
    try {
      const attendance = await HRService.getTodayAttendance(user.uid);
      setTodayAttendance(attendance);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      await HRService.checkIn(user.uid);
      await fetchTodayAttendance();
    } catch (error) {
      console.error("Error checking in:", error);
      alert("Failed to check in");
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance) return;
    setProcessing(true);
    try {
      await HRService.checkOut(todayAttendance.id);
      await fetchTodayAttendance();
    } catch (error) {
      console.error("Error checking out:", error);
      alert("Failed to check out");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="text-center py-8">Loading...</div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-gray-600 mt-2">Record your check-in and check-out</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAttendance ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Check In</p>
                    <p className="text-lg font-semibold">
                      {todayAttendance.checkIn.toDate().toLocaleTimeString()}
                    </p>
                  </div>
                  {todayAttendance.checkOut && (
                    <div>
                      <p className="text-sm text-gray-600">Check Out</p>
                      <p className="text-lg font-semibold">
                        {todayAttendance.checkOut.toDate().toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
                {todayAttendance.totalHours > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Total Hours</p>
                    <p className="text-lg font-semibold">{todayAttendance.totalHours} hours</p>
                  </div>
                )}
                {!todayAttendance.checkOut && (
                  <Button onClick={handleCheckOut} disabled={processing} className="w-full">
                    <Clock className="mr-2 h-4 w-4" />
                    Check Out
                  </Button>
                )}
              </div>
            ) : (
              <Button onClick={handleCheckIn} disabled={processing} className="w-full">
                <Clock className="mr-2 h-4 w-4" />
                Check In
              </Button>
            )}
          </CardContent>
        </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

