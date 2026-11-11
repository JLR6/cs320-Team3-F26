import { 
    ForbiddenException, 
    Inject, 
    Injectable, 
    InternalServerErrorException, 
    UnauthorizedException } 
from "@nestjs/common";

import { SupabaseService } from '../../src/integrations/supabase/supabase.service';

enum SUBMISSION_STATES {
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

    async findAllUserProblems(accessToken: string, userId: string) {
        const client = this.supabase.forUser(accessToken);

        const { data, error, status } = await client.from('user_problems').select('*').eq('user_id', userId);
    }

    private fail(status: number, message: string): never {
        if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
        if (status === 403) throw new ForbiddenException('Operation not permitted');
        throw new InternalServerErrorException(message);
    }
}