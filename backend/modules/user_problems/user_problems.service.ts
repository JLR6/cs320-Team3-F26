import { 
    ForbiddenException, 
    Inject, 
    Injectable, 
    InternalServerErrorException, 
    UnauthorizedException } 
from "@nestjs/common";

import { SupabaseService } from '../../src/integrations/supabase/supabase.service';

export enum SUBMISSION_STATES {
    COMPLETED = "completed",
    INCOMPLETE = "incomplete",
}

export interface UserProblemRecord {
    user_id: string,
    problem_number: number,
    created_at: string,
    updated_at: string,
    submission_state: SUBMISSION_STATES
}

@Injectable()
export class UserProblemsService {
    constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

    // Fetches all problems
    async getAllUserProblems(accessToken: string, userId: string) {
        const client = this.supabase.forUser(accessToken);

        const { data, error, status } = await client
            .from('user_problems')
            .select('*')
            .order('created_at', { ascending: false })
            .eq('user_id', userId)
            .returns<UserProblemRecord[]>(); 

        if (error) { this.fail(status, 'Unable to fetch user problems') }

        return data;
    }

    // Each week ends on sunday at 11:59pm, Resetting on the start of monday
    async getWeeklyProblems(accessToken: string, userId: string) {
        const client = this.supabase.forUser(accessToken);

        const now = new Date();
        const time_since_sunday_reset = new Date(now);
        time_since_sunday_reset.setDate(now.getDate() - now.getDay());
        time_since_sunday_reset.setHours(23, 59, 59, 0);
        // This calculates the time since the last Sunday at 11:59pm, effectively resetting on Monday.

        const { data, error, status } = await client
            .from('user_problems')
            .select('*')
            .order('created_at', { ascending: false })
            .eq('user_id', userId)
            // Filter problems created within the last week
            // 7 * 24 * 60 * 60 * 1000 = 7 days in milliseconds for converting
            .gte('created_at', time_since_sunday_reset)
            .returns<UserProblemRecord[]>(); 

        if (error) { this.fail(status, 'Unable to fetch weekly user problems') }

        return data;

    }

    async create(accessToken: string, userId: string, problemNumber: number, submissionState: SUBMISSION_STATES) {
        const client = this.supabase.forUser(accessToken);

        const { data, error, status } = await client
            .from('user_problems')
            .insert({
                user_id: userId,
                problem_number: problemNumber,
                submission_state: submissionState,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .returns<UserProblemRecord[]>();

        if (error) { this.fail(status, 'Unable to create user problem') }

        return data;
    }

    async update(accessToken: string, userId: string, problemNumber: number, submissionState: SUBMISSION_STATES) {
        const client = this.supabase.forUser(accessToken);

        const { data, error, status } = await client
            .from('user_problems')
            .update({
                submission_state: submissionState,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('problem_number', problemNumber)
            .returns<UserProblemRecord[]>();

        if (error) { this.fail(status, 'Unable to update user problem') }

        return data;
    }

    async delete(accessToken: string, userId: string, problemNumber: number) {
        const client = this.supabase.forUser(accessToken);

        const { data, error, status } = await client
            .from('user_problems')
            .delete()
            .eq('user_id', userId)
            .eq('problem_number', problemNumber)
            .returns<UserProblemRecord[]>();

        if (error) { this.fail(status, 'Unable to delete user problem') }

        return data;
    }

    private fail(status: number, message: string): never {
        if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
        if (status === 403) throw new ForbiddenException('Operation not permitted');
        throw new InternalServerErrorException(message);
    }
}