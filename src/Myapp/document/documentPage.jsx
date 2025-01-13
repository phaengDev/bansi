import React ,{ useState, useEffect } from 'react'
import { CheckTree } from 'rsuite';

  // Generate Mock Tree Data
 
function DocumentPage() {
  
  return (
    <div id="content" class="app-content p-0 d-flex flex-column">
			
			<div class="panel panel-inverse flex-1 m-0 d-flex flex-column overflow-hidden">
				
				<div class="panel-body p-0 flex-1 overflow-hidden">
					<div class="file-manager h-100" id="fileManager">
						<div class="file-manager-toolbar">
							 <button type="button" class="btn shadow-none text-body border-0"><i class="fa fa-lg me-1 fa-plus"></i> File</button>
							 <button type="button" class="btn shadow-none text-body border-0"><i class="fa fa-lg me-1 fa-plus"></i> Folder</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-copy"></i> Copy</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-move"></i> Move</button>
							 <button type="button" class="btn shadow-none text-body border-0"><i class="fa fa-lg me-1 fa-upload"></i> Upload</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-download"></i> Download</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-xmark"></i> Delete</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-rotate-left"></i> Restore</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-file"></i> Rename</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-pen"></i> Edit</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-pen-to-square"></i> HTML Editor</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-key"></i> Permissions</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-file"></i> View</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-lock-open"></i> Extract</button>
							 <button type="button" class="btn shadow-none text-body text-opacity-50 border-0" disabled><i class="fa fa-lg me-1 fa-file-zipper"></i> Compress</button>
						</div>
						<div class="file-manager-container">
							<div class="file-manager-sidebar">
								<div class="file-manager-sidebar-mobile-toggler">
									<button type="button" class="btn" data-toggle-class="file-manager-sidebar-mobile-toggled" data-target="#fileManager"><i class="far fa-lg fa-folder"></i></button>
								</div>
								<div class="file-manager-sidebar-content">
									<div data-scrollbar="true" data-height="100%" class="p-3">
										<input type="text" class="form-control form-control-sm mb-3" placeholder="Seach file..." />
										<div class="file-tree mb-3">
                                        <CheckTree data={[]} defaultExpandAll showIndentLine />
										</div>
									</div>
								</div>
								<div class="file-manager-sidebar-footer">
									<div class="d-flex align-items-center">
										<div class="mx-n1">
											<iconify-icon class="fa-3x" icon="solar:ssd-square-bold-duotone"></iconify-icon>
										</div>
										<div class="flex-1 ps-3 small">
											<div class="fw-bold">SSD Storage:</div>
											<div class="progress h-5px my-1">
												<div class="progress-bar progress-bar-striped bg-inverse" style={{width: '80%'}}></div>
											</div>
											<div class="fw-bold text-body text-opacity-75">
												<b class="text-body">127.7GB</b> free of <b class="text-body">256GB</b>
											</div>
										</div>
									</div>
								</div>
							</div>
							<div class="file-manager-content d-flex flex-column">
								<div class="mb-0 d-flex text-nowrap p-3 border-bottom">
									<button type="button" class="btn btn-sm btn-white me-2 px-2"><i class="fa fa-fw fa-home"></i></button>
									<button type="button" class="btn btn-sm btn-white me-2" disabled><i class="fa fa-fw fa-arrow-turn-up ms-n1"></i>  Up One Level</button>
							
									<div class="btn-group me-2">
										<button type="button" class="btn btn-sm btn-white" disabled><i class="fa me-1 fa-arrow-left"></i> Back</button>
										<button type="button" class="btn btn-sm btn-white text-opacity-50" disabled><i class="fa me-1 fa-arrow-right"></i> Forward</button>
									</div>
									<button type="button" class="btn btn-sm btn-white me-2 px-2"><i class="fa fa-fw fa-arrows-rotate"></i></button>
							
									<div class="btn-group me-2">
										<button type="button" class="btn btn-sm btn-white"><i class="fa fa-fw fa-check ms-n1"></i> Select All</button>
										<button type="button" class="btn btn-sm btn-white"><i class="far fa-fw fa-square ms-n1"></i> Unselect All</button>
									</div>
								</div>
								<div class="flex-1 overflow-hidden">
									<div data-scrollbar="true" data-skip-mobile="true" data-height="100%" class="p-0">
										<table class="table table-striped table-borderless table-sm m-0 text-nowrap">
											<thead>
												<tr class="border-bottom">
													<th class="w-10px ps-10px"></th>
													<th class="px-10px">Name</th>
													<th class="px-10px w-100px">Size</th>
													<th class="px-10px w-200px">Last Modified</th>
													<th class="px-10px w-200px">Type</th>
													<th class="px-10px w-100px">Permission</th>
												</tr>
											</thead>
											<tbody>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">services</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:35PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
                                                <tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
                                                <tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
                                                <tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
                                                <tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
                                                <tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">portfolio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">blog</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:04PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">assets</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:14PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">php</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">docs</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">archives</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">video</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">audio</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-folder text-warning fa-lg"></i></td>
													<td class="px-10px border-0">docs</td>
													<td class="px-10px">4 KB</td>
													<td class="px-10px">Jun 11, 2024, 10:36PM</td>
													<td class="px-10px">http:/unix-directory</td>
													<td class="px-10px border-0">0755</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">index.html</td>
													<td class="px-10px">39.5 KB</td>
													<td class="px-10px">July 05, 2024, 10:35PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">home.html</td>
													<td class="px-10px">129.1 KB</td>
													<td class="px-10px">July 06, 2024, 1:00PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">about.html</td>
													<td class="px-10px">24 KB</td>
													<td class="px-10px">July 01, 2024, 6:59AM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">contact.html</td>
													<td class="px-10px">39.5 KB</td>
													<td class="px-10px">July 05, 2024, 10:35PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">testimonials.html</td>
													<td class="px-10px">11 KB</td>
													<td class="px-10px">July 05, 2024, 10:35PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">faq.html</td>
													<td class="px-10px">12 KB</td>
													<td class="px-10px">July 05, 2024, 1.59PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">pricing.html</td>
													<td class="px-10px">128 KB</td>
													<td class="px-10px">July 05, 2024, 12.49PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-code text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">404.shtml</td>
													<td class="px-10px">251 bytes</td>
													<td class="px-10px">July 10, 2024, 10.35AM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="fa fa-file-text text-body text-opacity-50 fa-lg"></i></td>
													<td class="px-10px border-0">.htaccess</td>
													<td class="px-10px">128 KB</td>
													<td class="px-10px">August 05, 2024, 12.49PM</td>
													<td class="px-10px">text/html</td>
													<td class="px-10px border-0">0644</td>
												</tr>
												<tr>
													<td class="ps-10px border-0 text-center"><i class="far fa-file-image text-teal fa-lg"></i></td>
													<td class="px-10px border-0">favicon.ico</td>
													<td class="px-10px">2 KB</td>
													<td class="px-10px">July 05, 2024, 7.39AM</td>
													<td class="px-10px">image/x-generic</td>
													<td class="px-10px border-0">0644</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
  )
}

export default DocumentPage