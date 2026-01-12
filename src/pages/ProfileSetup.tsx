"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { User, Loader2 } from 'lucide-react'; // Import Loader2

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { showSuccess, showError } from '@/utils/toast'; // Import sonner toast utilities

// Define the form schema using Zod
const profileFormSchema = z.object({
  firstName: z.string().min(1, { message: "First Name is required." }).max(50, { message: "First Name cannot exceed 50 characters." }),
  lastName: z.string().min(1, { message: "Last Name is required." }).max(50, { message: "Last Name cannot exceed 50 characters." }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ProfileSetup = () => {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const navigate = useNavigate();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingInitial(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
          throw error;
        }

        if (data) {
          form.reset({
            firstName: data.first_name || '',
            lastName: data.last_name || '',
          });
        }
      } catch (error: any) {
        showError(`Error loading profile: ${error.message}`);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchProfile();
  }, [navigate, form]); // Added 'form' to dependency array

  const onSubmit = async (values: ProfileFormValues) => {
    form.setValue('firstName', values.firstName.trim()); // Trim before saving
    form.setValue('lastName', values.lastName.trim()); // Trim before saving
    form.clearErrors(); // Clear any previous errors

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError('Not authenticated. Please log in first.');
        navigate('/login');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      showSuccess('Profile updated successfully!');
      navigate('/'); // Redirect to home after saving
    } catch (error: any) {
      showError(`Save Failed: ${error.message || 'An unknown error occurred'}`);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-indigo-600 rounded-full">
            <User className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-indigo-900">
            Complete Your Profile
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Please provide your first and last name to continue.
          </p>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {form.formState.isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;