import { 
    Controller, 
    Delete, 
    Get, Inject, 
    Param, 
    Patch, 
    Post } 
from "@nestjs/common";
import { UserProblemsService } from "./user_problems.service";


@Controller('user-problems')
export class UserProblemsController {
    constructor(@Inject(UserProblemsService) private readonly userProblemsService: UserProblemsService) {}

    @Get()
    getAllUserProblems() {}

    @Post(':problem_number')
    createUserProblem(@Param('problem_number') problemNumber: string) {}

    @Patch(':problem_number')
    updateUserProblem(@Param('problem_number') problemNumber: string) {}

    @Delete(':problem_number')
    deleteUserProblem(@Param('problem_number') problemNumber: string) {}

}