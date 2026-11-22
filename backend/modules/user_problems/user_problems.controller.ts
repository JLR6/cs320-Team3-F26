import { 
    Controller, 
    Delete, 
    Get, Inject, Body, Headers,
    Param, 
    Patch, 
    Post, 
    UnauthorizedException} 
from "@nestjs/common";
import { UserProblemsService } from "./user_problems.service";
import { SUBMISSION_STATES } from "./user_problems.service";


@Controller('user-problems')
export class UserProblemsController {
    constructor(@Inject(UserProblemsService) private readonly userProblemsService: UserProblemsService) {}

    @Get(':userId')
    getAllUserProblems(
        @Param('userId') userId: string,
        @Headers('authorization') authorization?: string,
    ) {
        return this.userProblemsService.getAllUserProblems(this.accessToken(authorization), userId);
    }

    @Get(':userId/weekly')
    getWeeklyProblems(@Param('userId') userId: string,
                      @Headers('authorization') authorization?: string) {
        return this.userProblemsService.getWeeklyProblems(this.accessToken(authorization), userId);
    }

    @Post(':userId/:problem_number')
    createUserProblem(@Param('userId') userId: string,
                      @Param('problem_number') problemNumber: string,
                      @Headers('authorization') authorization: string,
                      @Body() body: { submission_state: SUBMISSION_STATES }) {
        return this.userProblemsService.create(this.accessToken(authorization), userId, Number(problemNumber), body.submission_state);
    }

    @Patch(':userId/:problem_number')
    updateUserProblem(@Param('userId') userId: string,
                      @Param('problem_number') problemNumber: string,
                      @Headers('authorization') authorization: string,
                      @Body() body: { submission_state: SUBMISSION_STATES }) {
        return this.userProblemsService.update(this.accessToken(authorization), userId, Number(problemNumber), body.submission_state);
    }

    @Delete(':userId/:problem_number')
    deleteUserProblem(@Param('userId') userId: string,
                      @Param('problem_number') problemNumber: string,
                      @Headers('authorization') authorization: string) {
        return this.userProblemsService.delete(this.accessToken(authorization), userId, Number(problemNumber));
    }

  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    return match[1];
  }

}