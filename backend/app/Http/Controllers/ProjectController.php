<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ProjectController extends Controller
{
    public function __construct(private ProjectService $projects) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['include_archived' => ['sometimes', 'boolean'], 'page' => ['sometimes', 'integer', 'min:1']]);

        return ProjectResource::collection($this->projects->list($request->user(), $request->boolean('include_archived')));
    }

    public function store(ProjectRequest $request): JsonResponse
    {
        return (new ProjectResource($this->projects->create($request->user(), $request->validated())))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $project): JsonResponse
    {
        return (new ProjectResource($this->projects->show($request->user(), $project)))->response()->setStatusCode(200);
    }

    public function update(ProjectRequest $request, int $project): JsonResponse
    {
        return (new ProjectResource($this->projects->update($request->user(), $project, $request->validated())))->response()->setStatusCode(200);
    }

    public function destroy(Request $request, int $project): Response
    {
        $this->projects->delete($request->user(), $project);

        return response()->noContent();
    }
}
