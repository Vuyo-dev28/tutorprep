import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { UserPlus, Copy, CheckCircle2, X, Mail, Key } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';

type ParentLink = {
  id: string;
  parent_email: string;
  student_id: string;
  access_code: string;
  is_active: boolean;
  created_at: string;
  student_name: string;
  student_grade: string;
};

export function ParentAccessManagement() {
  const [links, setLinks] = useState<ParentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newParentEmail, setNewParentEmail] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; grade: string }>>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      // Load all parent links (both manually created and auto-created from signup)
      const { data: linksData, error: linksError } = await supabase
        .from('parent_student_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;

      if (!linksData || linksData.length === 0) {
        setLinks([]);
        setIsLoading(false);
        return;
      }

      // Fetch student profiles separately to ensure we get the data
      const studentIds = [...new Set((linksData || []).map((link: any) => link.student_id).filter(Boolean))];
      
      if (studentIds.length === 0) {
        setLinks([]);
        setIsLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, grade, parent_email')
        .in('id', studentIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Create a map for quick lookup
      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      
      // Log for debugging
      console.log('Loaded profiles:', profilesData);
      console.log('Student IDs from links:', studentIds);
      console.log('Profiles map size:', profilesMap.size);
      
      // Check for missing profiles
      const missingProfiles = studentIds.filter(id => !profilesMap.has(id));
      if (missingProfiles.length > 0) {
        console.warn('Missing profiles for student IDs:', missingProfiles);
      }

      // Load all students (including those with parent_email in profile)
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select('id, full_name, grade, parent_email')
        .eq('role', 'student')
        .order('full_name');

      if (studentsError) throw studentsError;

      // Auto-create links for students with parent_email but no link yet
      const studentsWithParentEmail = (studentsData || []).filter(
        (s) => s.parent_email && s.parent_email.trim()
      );
      
      for (const student of studentsWithParentEmail) {
        const hasLink = (linksData || []).some((l) => l.student_id === student.id);
        if (!hasLink) {
          // Trigger will auto-create the link when we update the profile
          // But we can also manually create it here if needed
          try {
            const { data: codeData } = await supabase.rpc('generate_access_code');
            const accessCode = codeData || Math.random().toString(36).substring(2, 8).toUpperCase();
            
            await supabase
              .from('parent_student_links')
              .insert({
                parent_email: student.parent_email.toLowerCase().trim(),
                student_id: student.id,
                access_code: accessCode,
                is_active: true,
              })
              .select();
          } catch (err) {
            // Ignore errors (might already exist)
            console.error('Error auto-creating link:', err);
          }
        }
      }

      setStudents(studentsData || []);
      
      // Map links with profile data
      const mappedLinks = (linksData || []).map((link: any) => {
        const profile = profilesMap.get(link.student_id);
        const studentName = profile?.full_name || 'Unknown';
        const studentGrade = profile?.grade ? profile.grade.toString() : 'N/A';
        
        // Log for debugging
        if (!profile) {
          console.warn(`No profile found for student_id: ${link.student_id}`);
        }
        
        return {
          id: link.id,
          parent_email: link.parent_email,
          student_id: link.student_id,
          access_code: link.access_code,
          is_active: link.is_active,
          created_at: link.created_at,
          student_name: studentName,
          student_grade: studentGrade,
        };
      });
      
      console.log('Mapped links:', mappedLinks);
      setLinks(mappedLinks);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!supabase || !newParentEmail.trim() || !selectedStudentId) {
      alert('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      // Generate access code using the database function
      let accessCode: string;
      
      const { data: codeData, error: codeError } = await supabase.rpc('generate_access_code');

      if (codeError) {
        // Fallback: generate code client-side if function doesn't exist
        accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      } else {
        accessCode = codeData as string;
      }

      // Create the parent-student link
      const { error: insertError } = await supabase
        .from('parent_student_links')
        .insert({
          parent_email: newParentEmail.toLowerCase().trim(),
          student_id: selectedStudentId,
          access_code: accessCode,
          is_active: true,
        });

      if (insertError) {
        // If duplicate, update existing
        if (insertError.code === '23505') {
          const { error: updateError } = await supabase
            .from('parent_student_links')
            .update({
              access_code: accessCode,
              is_active: true,
            })
            .eq('parent_email', newParentEmail.toLowerCase().trim())
            .eq('student_id', selectedStudentId);

          if (updateError) throw updateError;
        } else {
          throw insertError;
        }
      }

      // Show success message with access code
      alert(`Access code created successfully!\n\nAccess Code: ${accessCode}\nParent Email: ${newParentEmail}\n\nPlease share this code with the parent.`);
      
      // Reset form
      setNewParentEmail('');
      setSelectedStudentId('');
      setIsDialogOpen(false);
      
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error creating link:', error);
      alert('Failed to create access code: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (linkId: string, currentStatus: boolean) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('parent_student_links')
        .update({ is_active: !currentStatus })
        .eq('id', linkId);

      if (error) throw error;

      await loadData();
    } catch (error: any) {
      console.error('Error updating link:', error);
      alert('Failed to update link: ' + error.message);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center text-gray-500">Loading parent access codes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Parent Access Management</h3>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage access codes for parents to view their children's progress
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Access Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Parent Access Code</DialogTitle>
                <DialogDescription>
                  Generate a new access code linking a parent email to a student account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="parent-email">Parent Email</Label>
                  <Input
                    id="parent-email"
                    type="email"
                    placeholder="parent@example.com"
                    value={newParentEmail}
                    onChange={(e) => setNewParentEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="student-select">Student</Label>
                  <select
                    id="student-select"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                  >
                    <option value="">Select a student...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name} (Grade {student.grade})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleCreateLink}
                  disabled={isCreating || !newParentEmail.trim() || !selectedStudentId}
                  className="w-full"
                >
                  {isCreating ? 'Creating...' : 'Generate Access Code'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent Email</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Access Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No parent access codes created yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                links.map((link) => (
                  <motion.tr
                    key={link.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {link.parent_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{link.student_name}</div>
                        <div className="text-sm text-gray-500">Grade {link.student_grade}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm">
                          {link.access_code}
                        </code>
                        <button
                          onClick={() => handleCopyCode(link.access_code)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Copy code"
                        >
                          {copiedCode === link.access_code ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={link.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                      >
                        {link.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(link.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(link.id, link.is_active)}
                      >
                        {link.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
