import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';

interface Team {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  memberCount: number;
  status: 'active' | 'inactive' | 'archived';
  visibility: 'public' | 'private' | 'restricted';
  settings: TeamSettings;
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Date;
  lastActive: Date;
  permissions: string[];
  department?: string;
  position?: string;
}

interface TeamSettings {
  notifications: {
    email: boolean;
    push: boolean;
    digest: boolean;
  };
  permissions: {
    inviteMembers: boolean;
    manageRoles: boolean;
    deleteTeam: boolean;
    editSettings: boolean;
  };
  collaboration: {
    allowGuestAccess: boolean;
    requireApproval: boolean;
    autoArchive: boolean;
  };
}

interface CreateTeamData {
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'restricted';
}

interface InviteMemberData {
  email: string;
  role: 'viewer' | 'member' | 'admin';
  message: string;
}

export const useTeams = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 模拟API调用 - 在实际应用中应该连接到真实的API
  const mockApiCall = <T>(data: T, delay: number = 1000): Promise<T> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(data), delay);
    });
  };

  // 生成模拟数据
  const generateMockTeams = (): Team[] => [
    {
      id: '1',
      name: '产品开发团队',
      description: '负责产品功能开发和维护的核心团队',
      avatar: '',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-12-15'),
      ownerId: 'user-1',
      memberCount: 8,
      status: 'active',
      visibility: 'private',
      settings: {
        notifications: { email: true, push: true, digest: false },
        permissions: { inviteMembers: true, manageRoles: true, deleteTeam: false, editSettings: true },
        collaboration: { allowGuestAccess: false, requireApproval: true, autoArchive: false },
      },
    },
    {
      id: '2',
      name: '市场营销团队',
      description: '负责市场推广、品牌建设和用户增长',
      avatar: '',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-12-10'),
      ownerId: 'user-2',
      memberCount: 5,
      status: 'active',
      visibility: 'public',
      settings: {
        notifications: { email: true, push: false, digest: true },
        permissions: { inviteMembers: false, manageRoles: false, deleteTeam: false, editSettings: false },
        collaboration: { allowGuestAccess: true, requireApproval: false, autoArchive: true },
      },
    },
    {
      id: '3',
      name: '客户支持团队',
      description: '7x24小时客户服务和技术支持团队',
      avatar: '',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-12-12'),
      ownerId: 'user-3',
      memberCount: 12,
      status: 'active',
      visibility: 'restricted',
      settings: {
        notifications: { email: true, push: true, digest: true },
        permissions: { inviteMembers: true, manageRoles: false, deleteTeam: false, editSettings: true },
        collaboration: { allowGuestAccess: false, requireApproval: true, autoArchive: false },
      },
    },
  ];

  const generateMockMembers = (teamId: string): TeamMember[] => [
    {
      id: '1',
      userId: 'user-1',
      teamId,
      name: '张三',
      email: 'zhangsan@example.com',
      avatar: '',
      role: 'owner',
      status: 'active',
      joinedAt: new Date('2024-01-15'),
      lastActive: new Date('2024-12-15'),
      permissions: ['all'],
      department: '技术部',
      position: '技术总监',
    },
    {
      id: '2',
      userId: 'user-2',
      teamId,
      name: '李四',
      email: 'lisi@example.com',
      avatar: '',
      role: 'admin',
      status: 'active',
      joinedAt: new Date('2024-02-01'),
      lastActive: new Date('2024-12-14'),
      permissions: ['manage_members', 'edit_settings'],
      department: '技术部',
      position: '高级工程师',
    },
    {
      id: '3',
      userId: 'user-3',
      teamId,
      name: '王五',
      email: 'wangwu@example.com',
      avatar: '',
      role: 'member',
      status: 'active',
      joinedAt: new Date('2024-03-15'),
      lastActive: new Date('2024-12-13'),
      permissions: ['view', 'comment'],
      department: '技术部',
      position: '前端工程师',
    },
    {
      id: '4',
      userId: 'user-4',
      teamId,
      name: '赵六',
      email: 'zhaoliu@example.com',
      avatar: '',
      role: 'member',
      status: 'active',
      joinedAt: new Date('2024-04-10'),
      lastActive: new Date('2024-12-12'),
      permissions: ['view', 'comment'],
      department: '技术部',
      position: '后端工程师',
    },
    {
      id: '5',
      userId: 'user-5',
      teamId,
      name: '孙七',
      email: 'sunqi@example.com',
      avatar: '',
      role: 'viewer',
      status: 'pending',
      joinedAt: new Date('2024-12-01'),
      lastActive: new Date('2024-12-01'),
      permissions: ['view'],
      department: '产品部',
      position: '产品经理',
    },
  ];

  // 获取团队列表
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mockApiCall(generateMockTeams());
      setTeams(data);
    } catch (err) {
      setError('Failed to fetch teams');
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取团队成员
  const getTeamMembers = useCallback(async (teamId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await mockApiCall(generateMockMembers(teamId));
      setMembers(data);
    } catch (err) {
      setError('Failed to fetch team members');
      console.error('Error fetching team members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建团队
  const createTeam = useCallback(async (teamData: CreateTeamData) => {
    setLoading(true);
    setError(null);
    try {
      const newTeam: Team = {
        id: Date.now().toString(),
        ...teamData,
        avatar: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: 'current-user',
        memberCount: 1,
        status: 'active',
        settings: {
          notifications: { email: true, push: true, digest: false },
          permissions: { inviteMembers: true, manageRoles: true, deleteTeam: true, editSettings: true },
          collaboration: { allowGuestAccess: false, requireApproval: true, autoArchive: false },
        },
      };

      await mockApiCall(newTeam, 500);
      setTeams(prev => [...prev, newTeam]);
      return newTeam;
    } catch (err) {
      setError('Failed to create team');
      console.error('Error creating team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新团队
  const updateTeam = useCallback(async (teamId: string, updates: Partial<Team>) => {
    setLoading(true);
    setError(null);
    try {
      await mockApiCall(updates, 500);
      setTeams(prev => prev.map(team =>
        team.id === teamId
          ? { ...team, ...updates, updatedAt: new Date() }
          : team
      ));
    } catch (err) {
      setError('Failed to update team');
      console.error('Error updating team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 删除团队
  const deleteTeam = useCallback(async (teamId: string) => {
    setLoading(true);
    setError(null);
    try {
      await mockApiCall(null, 500);
      setTeams(prev => prev.filter(team => team.id !== teamId));
    } catch (err) {
      setError('Failed to delete team');
      console.error('Error deleting team:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 邀请成员
  const inviteMember = useCallback(async (teamId: string, inviteData: InviteMemberData) => {
    setLoading(true);
    setError(null);
    try {
      const newMember: TeamMember = {
        id: Date.now().toString(),
        userId: `user-${Date.now()}`,
        teamId,
        name: inviteData.email.split('@')[0],
        email: inviteData.email,
        avatar: '',
        role: inviteData.role,
        status: 'pending',
        joinedAt: new Date(),
        lastActive: new Date(),
        permissions: inviteData.role === 'admin' ? ['manage_members', 'edit_settings'] : ['view', 'comment'],
        department: '',
        position: '',
      };

      await mockApiCall(newMember, 500);
      setMembers(prev => [...prev, newMember]);

      // 更新团队成员数量
      setTeams(prev => prev.map(team =>
        team.id === teamId
          ? { ...team, memberCount: team.memberCount + 1 }
          : team
      ));
    } catch (err) {
      setError('Failed to invite member');
      console.error('Error inviting member:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 移除成员
  const removeMember = useCallback(async (teamId: string, memberId: string) => {
    setLoading(true);
    setError(null);
    try {
      await mockApiCall(null, 500);
      setMembers(prev => prev.filter(member => member.id !== memberId));

      // 更新团队成员数量
      setTeams(prev => prev.map(team =>
        team.id === teamId
          ? { ...team, memberCount: Math.max(0, team.memberCount - 1) }
          : team
      ));
    } catch (err) {
      setError('Failed to remove member');
      console.error('Error removing member:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新成员角色
  const updateMemberRole = useCallback(async (teamId: string, memberId: string, newRole: string) => {
    setLoading(true);
    setError(null);
    try {
      await mockApiCall(null, 500);
      setMembers(prev => prev.map(member =>
        member.id === memberId
          ? {
              ...member,
              role: newRole as any,
              permissions: newRole === 'admin' ? ['manage_members', 'edit_settings'] : ['view', 'comment']
            }
          : member
      ));
    } catch (err) {
      setError('Failed to update member role');
      console.error('Error updating member role:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取团队列表
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    members,
    loading,
    error,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    getTeamMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
  };
};